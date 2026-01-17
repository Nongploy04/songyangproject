// Google Apps Script Backend with Drive Integration
// This file should be uploaded to Google Apps Script

const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // Replace with your Google Sheet ID
const DRIVE_FOLDER_ID = '1ODlt5J0QLtmUQwzxte2_5n5BWy8Xefky'; // Project Images folder (Public)

function doGet(e) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Projects');
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
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    projects: projects,
    options: options
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    if (action === 'upload_to_drive') {
      return uploadToDrive(payload);
    } else if (action === 'parse_image_from_drive') {
      return parseImageFromDrive(payload);
    } else if (action === 'create') {
      return createProject(payload);
    } else if (action === 'update') {
      return updateProject(payload);
    } else if (action === 'delete') {
      return deleteProject(payload);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown action'
    })).setMimeType(ContentService.MimeType.JSON);
    
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

// Parse image from Drive URL using Gemini AI
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
    
    // Convert to base64 for Gemini API
    const base64Image = Utilities.base64Encode(blob.getBytes());
    
    // Call Gemini AI API
    const apiKey = 'AIzaSyCXsiVKskwitWyIwFmdemqAV5Wamas7kfQ'; // Gemini API key
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `วิเคราะห์รูปภาพนี้และดึงข้อมูลโครงการก่อสร้างออกมาในรูปแบบ JSON โดยมีฟิลด์ดังนี้:
{
  "title": "ชื่อโครงการ",
  "desc": "รายละเอียด/ปริมาณงาน",
  "budget": "งบประมาณ (ตัวเลขเท่านั้น)",
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
              mime_type: blob.getContentType(),
              data: base64Image
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
      // Extract JSON from response (remove markdown code blocks if present)
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
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Projects');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const newRow = headers.map(header => payload.data[header] || "");
  sheet.appendRow(newRow);
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Update existing project
function updateProject(payload) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Projects');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowIndex = parseInt(payload.id);
  
  headers.forEach((header, colIndex) => {
    if (payload.data[header] !== undefined) {
      sheet.getRange(rowIndex, colIndex + 1).setValue(payload.data[header]);
    }
  });
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Delete project
function deleteProject(payload) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Projects');
  const rowIndex = parseInt(payload.id);
  sheet.deleteRow(rowIndex);
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success'
  })).setMimeType(ContentService.MimeType.JSON);
}
