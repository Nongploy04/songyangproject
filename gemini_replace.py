import re

with open(r'd:\Nextc\GITHUB\songyangproject\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove handleDocxUpload
content = re.sub(r'\s*// --- NEW: Handle DOCX Upload ---\s*async function handleDocxUpload.*?}\s*(?=// Helper: File to Base64)', '\n\n', content, flags=re.DOTALL)

# Remove fileToBase64
content = re.sub(r'\s*// Helper: File to Base64\s*function fileToBase64.*?\n        }\n', '\n\n', content, flags=re.DOTALL)

# Remove handleImageUpload
content = re.sub(r'\s*// --- NEW: Handle Image Upload with Resizing ---\s*async function handleImageUpload.*?}\s*(?=// Helper: Resize Image using Canvas)', '\n\n', content, flags=re.DOTALL)

# Remove resizeImage
content = re.sub(r'\s*// Helper: Resize Image using Canvas\s*function resizeImage.*?\n        }\n', '\n\n', content, flags=re.DOTALL)

gemini_logic = '''        // --- NEW: Gemini Auto-fill Logic ---
        function openGeminiModal() {
            document.getElementById('gemini-json-input').value = "";
            document.getElementById('gemini-error-msg').style.display = "none";
            document.getElementById('gemini-modal').style.display = "flex";
            setTimeout(() => { document.getElementById('gemini-json-input').focus(); }, 100);
        }

        function closeGeminiModal() {
            document.getElementById('gemini-modal').style.display = "none";
        }

        function applyGeminiData() {
            const inputEl = document.getElementById('gemini-json-input');
            const errorEl = document.getElementById('gemini-error-msg');
            let jsonText = inputEl.value.trim();

            if (!jsonText) {
                errorEl.innerText = "กรุณาวางโค้ด JSON ก่อนกดยืนยันครับ";
                errorEl.style.display = "block";
                return;
            }

            // Cleanup potential markdown blocks
            jsonText = jsonText.replace(/^`(json)?|`$/gm, '').trim();

            let data;
            try {
                data = JSON.parse(jsonText);
            } catch (err) {
                errorEl.innerText = "รูปแบบ JSON ไม่ถูกต้องครับ โปรดตรวจสอบให้แน่ใจว่าคัดลอกมาครบถ้วนตั้งแต่ปีกกา { ถึง }";
                errorEl.style.display = "block";
                return;
            }

            // Iterate over JSON keys and fill elements that match the ID
            let filledCount = 0;
            for (const key in data) {
                 if (key.startsWith('f-')) {
                     const val = data[key];
                     if (val !== null && val !== "null" && val !== "") {
                         const el = document.getElementById(key);
                         if (el) {
                             let finalVal = String(val);
                             if (key === 'f-budget') {
                                 finalVal = finalVal.replace(/,/g, ''); // Clean budget just in case
                             }
                             el.value = finalVal;
                             filledCount++;
                         }
                     }
                 }
            }
            
            // Recalculate duration if start and end dates were filled
            if (typeof calculateAndSetDuration === 'function') {
                calculateAndSetDuration();
            }

            closeGeminiModal();
            const btn = document.getElementById('geminiAutoFillBtn');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> กรอกสำเร็จ ' + filledCount + ' ช่อง';
            btn.style.background = '#e6f4ea';
            btn.style.color = '#137333';
            btn.style.borderColor = '#1e8e3e';
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.background = '#e8f0fe';
                btn.style.color = '#1a73e8';
                btn.style.borderColor = '#1a73e8';
            }, 3000);
        }

'''

content = content.replace('// Helper: Fill form fields', gemini_logic + '        // Helper: Fill form fields')

with open(r'd:\Nextc\GITHUB\songyangproject\index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
