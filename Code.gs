// Google Apps Script Backend with Drive Integration (Version: v29.0)
// This file should be uploaded to Google Apps Script
/**
 * @OnlyCurrentDoc
 */
// ---
// หากเกิดปัญหา "Failed to fetch":
// ใน appsscript.json ต้องตั้งค่า "access": "ANYONE" และ "executeAs": "USER_DEPLOYING"
// ---

const SHEET_ID = '1qi2WNGDguZtkEtCU2FzzEF_jiVLN82yf23Hbv2H2weA';
const DRIVE_FOLDER_ID = '1ODlt5J0QLtmUQwzxte2_5n5BWy8Xefky'; // Project Images folder (Public)

function doGet(e) {
  // --- CacheService: เช็คแคชก่อนเพื่อความเร็ว ---
  const cache = CacheService.getScriptCache();
  const cached = cache.get('projectData');
  
  if (cached) {
    const callback = e.parameter.callback;
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + cached + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(cached)
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // ไม่มีแคช → อ่านจาก Sheet
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Sheet1');
  const optionsSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Options');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  // Convert to array of objects with _rowIndex
  const projects = rows.map((row, index) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    obj._rowIndex = index + 2; // +2 because: +1 for header, +1 for 1-based indexing
    return obj;
  });
  
  // Get options for autocomplete
  let options = {};
  if (optionsSheet) {
    const optData = optionsSheet.getDataRange().getValues();
    options = {
      contractors: optData.slice(1).map(r => r[0]).filter(x => x),
      supervisors: optData.slice(1).map(r => r[1]).filter(x => x),
      committees: optData.slice(1).map(r => r[2]).filter(x => x)
    };
  }
  
  const jsonOutput = JSON.stringify({
    status: 'success',
    projects: projects,
    options: options
  });
  
  // Cache for 10 minutes (600 seconds)
  cache.put('projectData', jsonOutput, 600);

  const callback = e.parameter.callback;
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonOutput + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  
  return ContentService.createTextOutput(jsonOutput)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    let payload;
    // พยายามอ่านแบบ JSON ก่อน
    try {
      if (e.postData && e.postData.contents) {
        payload = JSON.parse(e.postData.contents);
      }
    } catch (err) {
      // ถ้าไม่ใช่ JSON ให้ลองอ่านจาก parameter (Simple POST / Form-Encoded)
      payload = e.parameter;
    }
    
    // ถ้ายังไม่มี payload อีก ให้ใช้ parameter ตรงๆ
    if (!payload || Object.keys(payload).length === 0) {
      payload = e.parameter;
    }

    const action = payload.action;
    
    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Pong!' }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'upload_to_drive') {
      return uploadToDrive(payload);
    } else if (action === 'parse_image_from_drive') {
      return parseImageFromDrive(payload);
    } else if (action === 'create') {
      return createProject(payload);
    } else if (action === 'update') {
      return updateProject(payload);
    } else if (action === 'delete') {
      return deleteProject(payload);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Upload file to Google Drive
function uploadToDrive(payload) {
  try {
    const { fileName, mimeType, data } = payload;
    
    // Decode base64
    const blob = Utilities.newBlob(Utilities.base64Decode(data), mimeType, fileName);
    
    // Upload to Drive folder
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const file = folder.createFile(blob);
    
    // Make file publicly accessible (or set appropriate permissions)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      url: file.getUrl(),
      id: file.getId()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Upload failed: ' + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Parse image or document from Drive URL using Gemini AI
function parseImageFromDrive(payload) {
  try {
    const { imageUrl } = payload;
    
    // Extract file ID from URL
    const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || imageUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (!fileIdMatch) {
      throw new Error('Invalid Drive URL');
    }
    
    const fileId = fileIdMatch[1];
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const mimeType = blob.getContentType();
    
    // Convert to base64 for Gemini API
    const base64Data = Utilities.base64Encode(blob.getBytes());
    
    // Call Gemini AI API
    const apiKey = 'AIzaSyCXsiVKskwitWyIwFmdemqAV5Wamas7kfQ'; // Gemini API key
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `วิเคราะห์ไฟล์แนบนี้ (รูปภาพหรือเอกสารราชการ) และดึงข้อมูลโครงการก่อสร้างออกมาในรูปแบบ JSON โดยมีเงื่อนไขสำคัญดังนี้:
1. "title": ดึงชื่อโครงการออกมาโดย **ห้ามมีคำว่า "โครงการ" นำหน้า** (เช่น ถ้าในเอกสารเขียนว่า "โครงการก่อสร้างถนน..." ให้ดึงมาแค่ "ก่อสร้างถนน...")
2. "budget": ให้ดึงค่า **"ราคากลาง"** มาใช้เป็นลำดับแรก หากไม่มีให้ใช้งบประมาณตามข้อบัญญัติ (ส่งกลับเฉพาะตัวเลขเท่านั้น)
3. "desc": รายละเอียด/ปริมาณงาน
4. ฟิลด์อื่นๆ ให้ดึงตามที่ระบุในรูปแบบ JSON ข้างล่างนี้:
{
  "title": "ชื่อโครงการ (ไม่มีคำว่าโครงการนำหน้า)",
  "type": "ประเภทโครงการ (เลือกจาก: asphalt, concrete, gravel, soil, building)",
  "desc": "รายละเอียด/ปริมาณงาน",
  "budget": "งบประมาณ (ตัวเลขเท่านั้น ห้ามมีเครื่องหมายคอมมา)",
  "budgetSource": "แหล่งเงิน (เลือกจาก: งบข้อบัญญัติ, จ่ายขาดเงินสะสม, เงินอุดหนุนเฉพาะกิจ, เงินอุดหนุนจากหน่วยงานอื่น (อบจ.), เงินกันไว้เบิกเหลื่อมปี)",
  "orderNo": "เลขที่คำสั่ง",
  "orderDate": "วันที่ลงนาม (คำสั่ง) รูปแบบ yyyy-mm-dd",
  "contractNo": "เลขที่สัญญา",
  "signDate": "วันที่ลงนาม (สัญญา) รูปแบบ yyyy-mm-dd",
  "end": "สิ้นสุดสัญญา รูปแบบ yyyy-mm-dd",
  "duration": "ระยะเวลา (วัน)",
  "start": "วันที่แจ้งเข้างาน รูปแบบ yyyy-mm-dd",
  "deliveryDate": "วันที่ส่งมอบงาน รูปแบบ yyyy-mm-dd",
  "inspectionDate": "วันที่ตรวจรับ รูปแบบ yyyy-mm-dd",
  "contractor": "ผู้รับจ้าง",
  "supervisor": "ผู้ควบคุมงาน",
  "comm1": "คณะกรรมการคนที่ 1",
  "comm2": "คณะกรรมการคนที่ 2",
  "comm3": "คณะกรรมการคนที่ 3"
}

ถ้าไม่พบข้อมูลในฟิลด์ใด ให้ใส่ค่าว่าง "" แทน ตอบเฉพาะ JSON เท่านั้น ไม่ต้องมีคำอธิบายเพิ่มเติม`;
    
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }]
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.candidates && result.candidates[0]) {
      const text = result.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          data: data
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    throw new Error('Failed to parse AI response');
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'AI parsing failed: ' + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Create new project
function createProject(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Wait up to 10s for other processes
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Server is busy, please try again.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Sheet1');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Safety check: If "Project Type" column is missing, add it
    if (!headers.includes("Project Type")) {
      sheet.getRange(1, headers.length + 1).setValue("Project Type");
      headers.push("Project Type");
    }

    // Create row array based on headers
    const newRow = headers.map(header => payload.data[header] || "");
    
    // Append single row
    sheet.appendRow(newRow);
    
    // SYNC OPTIONS: Add new names to Options sheet if they don't exist
    syncOptions(payload.data);
    
    CacheService.getScriptCache().remove('projectData'); // ล้างแคช
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Update existing project
function updateProject(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Server is busy, please try again.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Sheet1');
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // Safety check: If "Project Type" column is missing, add it
    if (!headers.includes("Project Type")) {
      sheet.getRange(1, headers.length + 1).setValue("Project Type");
      headers.push("Project Type");
      // Re-read lastCol since we added one
      lastCol = sheet.getLastColumn();
    }
    const rowIndex = parseInt(payload.id);
    
    // Optimize: Read entire row, update in memory, write back once
    const range = sheet.getRange(rowIndex, 1, 1, lastCol);
    const values = range.getValues()[0];
    
    headers.forEach((header, colIndex) => {
      if (payload.data[header] !== undefined) {
        values[colIndex] = payload.data[header];
      }
    });
    
    range.setValues([values]);
    
    // SYNC OPTIONS: Add new names to Options sheet if they don't exist
    syncOptions(payload.data);

    CacheService.getScriptCache().remove('projectData'); // ล้างแคช
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Delete project
function deleteProject(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
     return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Server is busy'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Sheet1');
    const rowIndex = parseInt(payload.id);
    sheet.deleteRow(rowIndex);
    CacheService.getScriptCache().remove('projectData'); // ล้างแคช
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success'
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sync names from project data to Options sheet
 * @param {Object} data - Project data payload
 */
function syncOptions(data) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let optSheet = ss.getSheetByName('Options');
    
    // Create Options sheet if it doesn't exist
    if (!optSheet) {
      optSheet = ss.insertSheet('Options');
      optSheet.getRange(1, 1, 1, 3).setValues([["Contractors", "Supervisors", "Committees"]]);
    }
    
    // Read current options (skip header)
    const lastRow = Math.max(1, optSheet.getLastRow());
    const currentData = optSheet.getRange(1, 1, lastRow, 3).getValues();
    const headers = currentData[0];
    
    const contractors = currentData.slice(1).map(r => r[0]).filter(Boolean);
    const supervisors = currentData.slice(1).map(r => r[1]).filter(Boolean);
    const committees = currentData.slice(1).map(r => r[2]).filter(Boolean);

    // Names to check (Keys from COLUMN_MAP in index.html, but here we use headers)
    const newContractor = data["Contractor"];
    // Supervisors might be joined by \n
    const newSupervisors = (data["Supervisor"] || "").toString().split('\n').map(s => s.trim()).filter(Boolean);
    const newCommittees = [data["Committee 1"], data["Committee 2"], data["Committee 3"]].filter(Boolean);

    const updates = []; // To store rows to append for each column? Better to handle per column.

    const addUnique = (name, existingList, colIndex) => {
      if (name && !existingList.includes(name)) {
        // Find first empty row in that column
        let targetRow = 2;
        while (optSheet.getRange(targetRow, colIndex).getValue() !== "") {
          targetRow++;
        }
        optSheet.getRange(targetRow, colIndex).setValue(name);
        existingList.push(name); // Add to local list to prevent duplicates in same run
      }
    };

    // Column 1: Contractors
    addUnique(newContractor, contractors, 1);

    // Column 2: Supervisors
    newSupervisors.forEach(s => addUnique(s, supervisors, 2));

    // Column 3: Committees
    newCommittees.forEach(c => addUnique(c, committees, 3));

  } catch (err) {
    console.error('syncOptions failed: ' + err.toString());
  }
}

// --- MIGRATION UTILS ---
function migrateProjectTypes() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Sheet1');
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // check if "Project Type" exists
  let typeColIndex = headers.indexOf("Project Type");
  
  // If not exists, create it
  if (typeColIndex === -1) {
    sheet.getRange(1, lastCol + 1).setValue("Project Type");
    typeColIndex = lastCol; // 0-based index of new col
  }
  
  const dataRange = sheet.getDataRange();
  const data = dataRange.getValues();
  // Get Name column index (Assume "Project Name" or first column)
  // Based on index.html mapping: title: "Project Name"
  const nameColIndex = headers.indexOf("Project Name");
  if (nameColIndex === -1) return "Project Name header not found";
  
  const updates = [];
  
  // Iterate rows (skip header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const name = row[nameColIndex].toString().toLowerCase();
    let type = "soil"; // Default
    
    // Keyword Logic (Same as frontend)
    if (name.includes('แอสฟัล') || name.includes('ลาดยาง') || name.includes('asphalt')) {
        type = 'asphalt';
    } else if (name.includes('คอนกรีต') || name.includes('คสล') || name.includes('ค.ส.ล.')) {
        type = 'concrete';
    } else if (name.includes('หินคลุก') || name.includes('ลูกรัง')) {
        type = 'gravel';
    }
    
    // Only update if empty? Or overwrite all to be safe? 
    // User asked to backfill. Let's overwrite to ensure consistency.
    // We need to set the value in the correct column.
    // Efficient way: collect all types and write one column.
    updates.push([type]);
  }
  
  // Write back to Project Type column
  if (updates.length > 0) {
    sheet.getRange(2, typeColIndex + 1, updates.length, 1).setValues(updates);
  }
  
  return { status: 'success', updated: updates.length };
}
