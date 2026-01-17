# ⚙️ การตั้งค่า (Configuration Guide)

## 📝 สิ่งที่ต้องแก้ไข

### 1. ไฟล์ `Code.gs` (Google Apps Script Backend)

#### ตำแหน่งที่ต้องแก้ไข:
```javascript
// บรรทัดที่ 4-5
const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // ⚠️ ต้องแก้ไข
const DRIVE_FOLDER_ID = '1ODlt5J0QLtmUQwzxte2_5n5BWy8Xefky'; // ✅ แก้ไขแล้ว
```

#### วิธีหา Google Sheet ID:
1. เปิด Google Sheet ของคุณ
2. ดู URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
3. คัดลอก `SHEET_ID_HERE` มาใส่

**ตัวอย่าง**:
```javascript
const SHEET_ID = '1a2b3c4d5e6f7g8h9i0j'; // ✅ ถูกต้อง
```

---

#### ตำแหน่งที่ต้องแก้ไข (Gemini API Key):
```javascript
// บรรทัดที่ 121 (ในฟังก์ชัน parseImageFromDrive)
const apiKey = 'AIzaSyCXsiVKskwitWyIwFmdemqAV5Wamas7kfQ'; // ✅ แก้ไขแล้ว
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
```

**สถานะ**: ✅ **แก้ไขแล้ว** - ใช้โมเดล **gemini-2.5-flash** (Stable, รองรับ images + text)

---

### 2. ไฟล์ `js_main.html` (Frontend JavaScript)

#### ตำแหน่งที่ต้องแก้ไข:
```javascript
// บรรทัดที่ 2
const API_URL = 'https://script.google.com/macros/s/AKfycbxd0xC2SbmoBhkEoDCNszEF3eRPeeZA0LQshTOewXcVLad_YquleDJ5-nmpGeHISIKs/exec';
```

#### วิธีหา Deployed URL:
1. เปิด Google Apps Script
2. คลิก "Deploy" → "New deployment"
3. เลือก type: "Web app"
4. ตั้งค่า:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. คลิก "Deploy"
6. คัดลอก URL ที่ได้

**ตัวอย่าง**:
```javascript
const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

**หมายเหตุ**: URL ที่มีอยู่เดิมอาจใช้ได้ถ้าคุณ Deploy ในโปรเจกต์เดิม แต่ถ้า Deploy ใหม่ URL จะเปลี่ยน

---

## ✅ สิ่งที่แก้ไขแล้ว

### Google Drive Folder ID
```javascript
const DRIVE_FOLDER_ID = '1ODlt5J0QLtmUQwzxte2_5n5BWy8Xefky'; // ✅ แก้ไขแล้ว
```

**ลิงก์โฟลเดอร์**: https://drive.google.com/drive/folders/1ODlt5J0QLtmUQwzxte2_5n5BWy8Xefky

**สถานะ**: เปิดสาธารณะแล้ว (Anyone with link can view)

---

## 📋 Checklist การตั้งค่า

### ก่อน Deploy
- [ ] แก้ไข `SHEET_ID` ใน `Code.gs`
- [x] แก้ไข `apiKey` ใน `Code.gs` (แก้ไขแล้ว - gemini-2.5-flash)
- [x] ตรวจสอบ `DRIVE_FOLDER_ID` (แก้ไขแล้ว)

### หลัง Deploy
- [ ] Deploy Google Apps Script
- [ ] คัดลอก Deployment URL
- [ ] แก้ไข `API_URL` ใน `js_main.html`
- [ ] อัปโหลดไฟล์ทั้งหมดไปยัง Apps Script
- [ ] ทดสอบระบบ

---

## 🔍 วิธีตรวจสอบว่าตั้งค่าถูกต้อง

### 1. ตรวจสอบ Sheet ID
```javascript
// ลองรันใน Apps Script Editor
function testSheetId() {
  const sheet = SpreadsheetApp.openById(SHEET_ID);
  Logger.log(sheet.getName()); // ควรแสดงชื่อ Spreadsheet
}
```

### 2. ตรวจสอบ Drive Folder ID
```javascript
// ลองรันใน Apps Script Editor
function testFolderId() {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  Logger.log(folder.getName()); // ควรแสดง "Project Images" หรือชื่อโฟลเดอร์
}
```

### 3. ตรวจสอบ API Key
```javascript
// ลองรันใน Apps Script Editor
function testApiKey() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const response = UrlFetchApp.fetch(url);
  Logger.log(response.getResponseCode()); // ควรได้ 200
}
```

---

## 🚨 ข้อผิดพลาดที่พบบ่อย

### Error: "Cannot find sheet"
**สาเหตุ**: `SHEET_ID` ไม่ถูกต้อง
**แก้ไข**: ตรวจสอบ Sheet ID อีกครั้ง

### Error: "Cannot find folder"
**สาเหตุ**: `DRIVE_FOLDER_ID` ไม่ถูกต้อง
**แก้ไข**: ตรวจสอบ Folder ID อีกครั้ง (ตอนนี้ควรถูกต้องแล้ว)

### Error: "API key not valid"
**สาเหตุ**: Gemini API Key ไม่ถูกต้องหรือหมดอายุ
**แก้ไข**: สร้าง API Key ใหม่

### Error: "Script function not found"
**สาเหตุ**: Deploy ไม่สำเร็จหรือ URL ไม่ถูกต้อง
**แก้ไข**: Deploy ใหม่และอัปเดต URL

---

## 📞 ต้องการความช่วยเหลือ?

### ถ้าคุณไม่แน่ใจว่า API Key เดิมคืออะไร
1. ตรวจสอบใน Google Cloud Console
2. หรือสร้าง API Key ใหม่จาก https://aistudio.google.com/app/apikey

### ถ้าคุณไม่แน่ใจว่า Sheet ID คืออะไร
1. เปิด Google Sheet
2. ดู URL ในแถบที่อยู่
3. คัดลอกส่วนที่อยู่ระหว่าง `/d/` และ `/edit`

---

## 🎯 สรุป

### ต้องแก้ไขทั้งหมด 3 ค่า:

1. **`SHEET_ID`** ใน `Code.gs` (บรรทัดที่ 4)
   - หาจาก URL ของ Google Sheet

2. **`apiKey`** ใน `Code.gs` (บรรทัดที่ 89)
   - สร้างจาก https://aistudio.google.com/app/apikey

3. **`API_URL`** ใน `js_main.html` (บรรทัดที่ 2)
   - ได้จากการ Deploy Google Apps Script

### ค่าที่แก้ไขแล้ว:

✅ **`DRIVE_FOLDER_ID`** = `1ODlt5J0QLtmUQwzxte2_5n5BWy8Xefky`

---

**📌 หมายเหตุ**: หลังจากแก้ไขค่าทั้งหมดแล้ว ให้ Deploy Google Apps Script และทดสอบระบบ
