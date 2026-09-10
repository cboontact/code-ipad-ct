"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faGlobe } from "@fortawesome/free-solid-svg-icons";

export type AppLanguage = "th" | "en";

const STORAGE_KEY = "ipad-app-language";
const COOKIE_KEY = "ipad_language";

const translations: Record<string, string> = {
  "ระบบลงทะเบียนรับ iPad": "iPad Loan Registration",
  "โรงเรียนจอมทอง · สพม.เชียงใหม่": "Chomthong School · Chiang Mai SESA",
  "โรงเรียนจอมทอง": "Chomthong School",
  "ลงทะเบียน": "Register",
  "ประชาสัมพันธ์": "News & Information",
  "ผู้ดูแล": "Admin",
  "แดชบอร์ด": "Dashboard",
  "กลับหน้าลงทะเบียน": "Back to registration",
  "กลับหน้าหลัก": "Back to home",
  "เมนู": "Menu",
  "เมนูหลัก": "Main navigation",
  "เปิดเมนู": "Open menu",
  "ปิดเมนู": "Close menu",
  "สงวนลิขสิทธิ์": "All rights reserved",
  "เทคโนโลยีที่ใช้พัฒนาระบบ": "Technologies used",
  "ลงทะเบียนรับ": "Register for an",
  "ยืมเรียน": "learning loan",
  "ฟรี!!!": "FREE!",
  "สำหรับครูและนักเรียนโรงเรียนจอมทอง": "For teachers and students of Chomthong School",
  "ดูรายละเอียด": "View details",
  "เลือกประเภทผู้ลงทะเบียน": "Choose registration type",
  "เลือกให้ตรงกับสถานะของผู้ใช้งาน": "Select the option that matches your role",
  "สำหรับบุคลากร": "For personnel",
  "ครูและบุคลากร": "Teachers and Staff",
  "สำหรับนักเรียน": "For students",
  "นักเรียน": "Students",
  "เริ่มลงทะเบียน": "Start registration",
  "ข้อมูลที่กรอกจะใช้เพื่อดำเนินโครงการและจัดทำเอกสาร AWAT-03 เท่านั้น": "The information provided will only be used to administer the project and prepare AWAT-03 documents.",
  "รายละเอียดโครงการ": "Project information",
  "โครงการส่งเสริมการเรียนรู้ขั้นพื้นฐานทุกที่ทุกเวลา": "Anywhere Anytime Basic Education Learning Promotion Project",
  "เพื่อสนับสนุนครูด้วยเครื่องมือดิจิทัลที่พร้อมใช้ในการจัดการเรียนรู้": "Supporting teachers with ready-to-use digital tools for learning management.",
  "สถานศึกษา": "School",
  "หน่วยงานต้นสังกัด": "Supervising authority",
  "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาเชียงใหม่": "Chiang Mai Secondary Educational Service Area Office",
  "อุปกรณ์ตามโครงการ": "Project device",
  "โรงเรียนได้รับจัดสรร": "School allocation",
  "รวม 1,890 เครื่อง": "1,890 devices in total",
  "ครูและบุคลากร 127": "Teachers and staff 127",
  "นักเรียน 1,763": "Students 1,763",
  "ข่าวสารและเอกสาร": "News and documents",
  "รายการ": "items",
  "กำลังโหลดเอกสาร...": "Loading documents...",
  "เปิดรูปภาพ": "Open image",
  "เปิดเอกสาร": "Open document",
  "ดาวน์โหลด": "Download",
  "ยังไม่มีรายการประชาสัมพันธ์": "No announcements yet",
  "รูปภาพหรือเอกสารที่ผู้ดูแลเปิดใช้งานจะแสดงที่นี่โดยอัตโนมัติ": "Images and documents published by an administrator will appear here automatically.",
  "เลือกประเภทผู้ใช้ใหม่": "Choose another user type",
  "ลงทะเบียนรับ iPad สำหรับนักเรียน": "Student iPad registration",
  "ค้นหาข้อมูลนักเรียน": "Find student information",
  "ใช้เลขประจำตัวนักเรียนของโรงเรียนเพื่อค้นหาข้อมูล": "Use the school student ID to find your information.",
  "เลขประจำตัวนักเรียน": "Student ID",
  "กรอกเลขประจำตัวนักเรียน": "Enter student ID",
  "กำลังค้นหา...": "Searching...",
  "ค้นหาข้อมูล": "Search",
  "ระบบจะไม่แสดงรายชื่อนักเรียนจนกว่าจะยืนยันข้อมูลตรงกัน": "Student names are only shown after the information has been verified.",
  "ค้นหานักเรียนคนอื่น": "Find another student",
  "ตรวจสอบข้อมูลนักเรียน": "Verify student information",
  "มีความประสงค์รับ iPad หรือไม่?": "Would you like to receive an iPad?",
  "รับ iPad": "Receive iPad",
  "ไม่รับ iPad": "Decline iPad",
  "กรอกข้อมูลเพื่อจัดทำเอกสาร AWAT-03": "Provide information for the AWAT-03 document.",
  "บันทึกว่าไม่ประสงค์รับอุปกรณ์": "Record that you do not wish to receive the device.",
  "กลับไปเลือกใหม่": "Change selection",
  "เปลี่ยนคำตอบ": "Change answer",
  "ความประสงค์": "Selection",
  "ข้อมูลนักเรียน": "Student information",
  "ระดับชั้น / ห้อง": "Grade / room",
  "ชั้น / ห้อง": "Grade / room",
  "เลขที่": "Class no.",
  "ข้อมูลติดต่อ": "Contact information",
  "เบอร์โทรศัพท์": "Phone number",
  "อีเมลโรงเรียน": "School email",
  "อีเมล NDLP": "NDLP email",
  "ข้อมูลส่วนบุคคล": "Personal information",
  "เลขประจำตัวประชาชน / รหัส G / เลขประจำตัวบุคคลต่างด้าว": "Thai citizen ID / G-code / foreign person ID",
  "ที่อยู่ตามทะเบียนบ้าน": "Registered address",
  "บ้านเลขที่": "House no.",
  "หมู่": "Village no.",
  "ซอย": "Soi",
  "ถนน": "Road",
  "จังหวัด": "Province",
  "อำเภอ": "District",
  "ตำบล": "Subdistrict",
  "รหัสไปรษณีย์": "Postal code",
  "ข้อมูลผู้ปกครอง": "Guardian information",
  "ชื่อ-นามสกุลผู้ปกครอง": "Guardian full name",
  "เบอร์โทรศัพท์ผู้ปกครอง": "Guardian phone number",
  "ข้าพเจ้ารับทราบและยินยอมให้ใช้ข้อมูลส่วนบุคคลเพื่อดำเนินโครงการและจัดทำเอกสารที่เกี่ยวข้อง": "I acknowledge and consent to the use of personal data for this project and its related documents.",
  "ตรวจสอบและบันทึก": "Review and save",
  "ยืนยันการบันทึกข้อมูล": "Confirm submission",
  "กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนบันทึก": "Please verify your information before submitting.",
  "ยกเลิก": "Cancel",
  "ยืนยันและบันทึก": "Confirm and save",
  "กำลังบันทึก...": "Saving...",
  "บันทึกข้อมูลเรียบร้อยแล้ว": "Your information has been saved.",
  "ลงทะเบียนสำเร็จ": "Registration complete",
  "กลับหน้าหลัก": "Back to home",
  "สถานะการลงทะเบียนรับ iPad": "iPad registration status",
  "ได้รับอนุมัติแล้ว": "Approved",
  "ไม่ได้รับอนุมัติ": "Not approved",
  "บันทึกว่าไม่รับ iPad แล้ว": "iPad declined",
  "รอผู้ดูแลอนุมัติ": "Awaiting administrator approval",
  "ผู้ดูแลยืนยันสิทธิ์รับ iPad เรียบร้อยแล้ว": "Your iPad eligibility has been approved by an administrator.",
  "คำขอรับ iPad ไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ": "Your iPad request was not approved. Please contact an administrator.",
  "ระบบบันทึกความประสงค์ของนักเรียนเรียบร้อยแล้ว": "The student's selection has been recorded.",
  "ระบบกันโควตา iPad ไว้แล้ว กรุณารอผู้ดูแลตรวจสอบและอนุมัติ": "An iPad allocation has been reserved. Please wait for administrator review.",
  "ตรวจสอบนักเรียนคนอื่น": "Check another student",
  "ปิดรับลงทะเบียนนักเรียน": "Student registration closed",
  "ขณะนี้ปิดรับลงทะเบียนสำหรับนักเรียนแล้ว": "Student registration is currently closed.",
  "ยังสามารถอ่านรายละเอียดโครงการและเอกสารประชาสัมพันธ์ได้ตามปกติ": "Project information and announcements remain available.",
  "ดูรายละเอียดโครงการ": "View project information",
  "เลือกกลุ่มสาระการเรียนรู้": "Choose a learning area",
  "กลุ่มสาระการเรียนรู้": "Learning area",
  "ครูทั้งหมด": "teachers in total",
  "ลงทะเบียนแล้ว": "registered",
  "ยังไม่ลงทะเบียน": "not registered",
  "ค้นหาชื่อครู...": "Search teacher name...",
  "บันทึกแล้ว": "Submitted",
  "ยังไม่ได้ตอบ": "Not submitted",
  "ไม่พบรายชื่อที่ค้นหา": "No matching names found",
  "กลับไปเลือกกลุ่มสาระ": "Back to learning areas",
  "กลับไปเลือกรายชื่อ": "Back to name selection",
  "ตรวจสอบรายชื่อ": "Verify your name",
  "ตรวจสอบชื่อของท่านแล้วกดดำเนินการต่อ": "Check your name, then continue.",
  "กำลังตรวจสอบ...": "Verifying...",
  "ดำเนินการต่อ": "Continue",
  "ย้อนกลับ": "Back",
  "กำลังตอบในชื่อ": "Registering as",
  "ท่านมีความประสงค์รับ iPad ตามโครงการหรือไม่": "Would you like to receive an iPad under this project?",
  "กรอกข้อมูลสำหรับจัดทำเอกสารการรับอุปกรณ์": "Provide information for the device receipt document.",
  "ดูคำชี้แจงก่อนดำเนินการต่อ": "Read the guidance before continuing.",
  "ข้อมูลครูและบุคลากร": "Teacher and staff information",
  "ตำแหน่ง": "Position",
  "วิทยฐานะ": "Academic rank",
  "คำนำหน้า": "Title",
  "ชื่อ": "First name",
  "นามสกุล": "Last name",
  "ปิดรับลงทะเบียนครู": "Teacher registration closed",
  "ขณะนี้ปิดรับลงทะเบียนสำหรับครูและบุคลากรแล้ว": "Teacher and staff registration is currently closed.",
  "ท่านยังสามารถอ่านรายละเอียดโครงการและเอกสารประกอบได้ตามปกติ": "Project information and supporting documents remain available.",
  "เชื่อมต่อระบบไม่สำเร็จ": "Unable to connect",
  "ลองใหม่": "Try again",
  "ภาษา": "Language",
  "เลือกภาษา": "Choose your language",
  "กรุณาเลือกภาษาที่ต้องการใช้ สามารถเปลี่ยนภายหลังได้ทุกเมื่อ": "Choose the language you want to use. You can change it at any time.",
  "ภาษาไทย": "Thai",
  "English": "English",
  "ลงทะเบียนครู": "Teacher registrations",
  "ลงทะเบียนนักเรียน": "Student registrations",
  "ตรวจรับเอกสาร": "Document check-in",
  "สถานะรับเครื่องครู": "Teacher device handover",
  "สถานะรับเครื่องนักเรียน": "Student device handover",
  "จัดการครู": "Manage teachers",
  "จัดการนักเรียน": "Manage students",
  "กลุ่มสาระ": "Learning areas",
  "ครูที่ปรึกษา": "Class advisors",
  "คืน iPad": "Return iPad",
  "ตั้งค่า": "Settings",
  "จัดการผู้ดูแลระบบ": "Manage administrators",
  "เมนูผู้ดูแลระบบ": "Admin menu",
  "หน้าลงทะเบียน": "Registration page",
  "ออกจากระบบ": "Sign out",
  "ยืนยันการออกจากระบบ": "Confirm sign out",
  "ต้องการออกจากระบบผู้ดูแลใช่หรือไม่?": "Do you want to sign out of the admin system?",
  "กำลังออกจากระบบ...": "Signing out...",
  "เข้าสู่ระบบผู้ดูแล": "Administrator sign in",
  "ชื่อผู้ใช้": "Username",
  "รหัสผ่าน": "Password",
  "เข้าสู่ระบบ": "Sign in",
  "กำลังเข้าสู่ระบบ...": "Signing in...",
  "ข้อมูลทั้งหมด": "All records",
  "ค้นหา": "Search",
  "ทุกสถานะ": "All statuses",
  "ทุกระดับชั้น": "All grade levels",
  "ทุกห้อง": "All rooms",
  "จัดการ": "Actions",
  "แก้ไข": "Edit",
  "ลบ": "Delete",
  "บันทึก": "Save",
  "ปิด": "Close",
  "ยืนยัน": "Confirm",
  "ประวัติ": "History",
  "สถานะ": "Status",
  "วันที่": "Date",
  "วันที่ตอบ": "Response date",
  "ผลอนุมัติ": "Approval result",
  "ยังไม่ลงทะเบียน": "Not registered",
  "รออนุมัติ": "Pending approval",
  "อนุมัติแล้ว": "Approved",
  "ไม่อนุมัติ": "Rejected",
  "กำลังโหลด...": "Loading...",
  "ไม่พบข้อมูล": "No records found",
  "โครงการส่งเสริมการเรียนรู้ขั้นพื้นฐานทุกที่ ทุกเวลา เพื่อสนับสนุนครูด้วยเครื่องมือดิจิทัลที่พร้อมใช้ในการจัดการเรียนรู้": "The Anywhere Anytime Basic Education Learning Promotion Project supports teachers with ready-to-use digital tools for learning management.",
  "จำนวน iPad คงเหลือสำหรับครูและบุคลากร": "Available iPads for teachers and staff",
  "จำนวน iPad คงเหลือสำหรับนักเรียน": "Available iPads for students",
  "iPad สำหรับครูและบุคลากร": "iPads for teachers and staff",
  "iPad สำหรับนักเรียน": "iPads for students",
  "จำนวนเครื่องที่ยังว่าง": "Devices available",
  "เครื่อง": "devices",
  "ครู": "teachers",
  "คน": "people",
  "% สำเร็จ": "% complete",
  "ม.ต้น": "Lower secondary",
  "ม.ปลาย": "Upper secondary",
  "ระบบสำหรับผู้ดูแล": "Administration",
  "จัดการการลงทะเบียน รายชื่อครู นักเรียน และเอกสารโครงการ": "Manage registrations, teacher and student records, and project documents.",
  "ตราโรงเรียนจอมทอง": "Chomthong School emblem",
  "ภาษาไทย": "Thai",
  "คณิตศาสตร์": "Mathematics",
  "วิทยาศาสตร์และเทคโนโลยี": "Science and Technology",
  "สังคมศึกษา ศาสนา และวัฒนธรรม": "Social Studies, Religion and Culture",
  "สุขศึกษาและพลศึกษา": "Health and Physical Education",
  "ศิลปะ": "Arts",
  "การงานอาชีพ": "Occupations",
  "ภาษาต่างประเทศ": "Foreign Languages",
  "กิจกรรมพัฒนาผู้เรียน": "Student Development Activities",
  "ฝ่ายบริหาร": "Administration",
  "กรอกตัวเลข 13 หลัก": "Enter 13 digits",
  "กรุณากรอกชื่อผู้ปกครองพร้อมคำนำหน้า นาย นาง หรือนางสาว": "Enter the guardian's full name including an appropriate title.",
  "กรุณากรอกที่อยู่ตามทะเบียนบ้านให้ครบ": "Complete the registered address.",
  "กรุณากรอกบ้านเลขที่": "Enter the house number.",
  "กรุณากรอกเบอร์โทรศัพท์ผู้ปกครองให้ถูกต้อง": "Enter a valid guardian phone number.",
  "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง": "Enter a valid phone number.",
  "กรุณากรอกเลขประจำตัวนักเรียน": "Enter the student ID.",
  "กรุณายืนยันตัวตนใหม่อีกครั้ง": "Please verify your identity again.",
  "กรุณารับทราบการใช้ข้อมูลส่วนบุคคล": "Please acknowledge the use of personal data.",
  "กรุณาเลือกจังหวัด": "Select a province.",
  "กรุณาเลือกตำบล": "Select a subdistrict.",
  "กรุณาเลือกตำแหน่ง": "Select a position.",
  "กรุณาเลือกวิทยฐานะ": "Select an academic rank.",
  "กรุณาเลือกอำเภอ": "Select a district.",
  "ตรวจสอบข้อมูลไม่สำเร็จ": "Unable to verify the information.",
  "ตรวจสอบจำนวนไม่ได้": "Unable to check availability.",
  "ตรวจสอบรายชื่อเรียบร้อยแล้ว": "Name verified successfully.",
  "ตรวจสอบรายชื่อไม่สำเร็จ": "Unable to verify the name.",
  "พบข้อมูลการลงทะเบียนแล้ว": "Registration found.",
  "ยืนยันข้อมูลนักเรียนเรียบร้อยแล้ว": "Student information verified.",
  "ยืนยันบันทึก": "Confirm submission",
  "บันทึกข้อมูลไม่สำเร็จ": "Unable to save the information.",
  "บันทึกไม่สำเร็จ": "Unable to save.",
  "โหลดข้อมูลจังหวัดไม่สำเร็จ": "Unable to load provinces.",
  "โหลดข้อมูลตำบลไม่สำเร็จ": "Unable to load subdistricts.",
  "โหลดข้อมูลอำเภอไม่สำเร็จ": "Unable to load districts.",
  "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่": "Unable to load data. Please try again.",
  "โหลดรายชื่อจังหวัดไม่สำเร็จ": "Unable to load provinces.",
  "โหลดรายชื่อตำบลไม่สำเร็จ": "Unable to load subdistricts.",
  "โหลดรายชื่ออำเภอไม่สำเร็จ": "Unable to load districts.",
  "โหลดรายชื่อไม่สำเร็จ": "Unable to load the list.",
  "ชื่อผู้ปกครองต้องไม่เป็นชื่อเดียวกับนักเรียน กรุณาตรวจสอบอีกครั้ง": "The guardian's name cannot be the same as the student's. Please check again.",
  "หมายเลขโทรศัพท์ไม่ถูกต้อง": "Invalid phone number.",
  "รหัสไปรษณีย์ต้องมี 5 หลัก": "Postal code must contain 5 digits.",
  "เลขประจำตัวประชาชนไม่ถูกต้อง": "Invalid Thai citizen ID.",
  "เลขประจำตัวไม่ถูกต้อง กรุณาตรวจเลขคนไทย 13 หลัก รหัส G หรือเลขที่ขึ้นต้นด้วย 0": "Invalid ID. Check the 13-digit Thai citizen ID, G-code, or foreign ID beginning with 0.",
  "ต้องใช้อีเมล @chomthong.ac.th": "Must use an @chomthong.ac.th email address.",
  "ต้องใช้อีเมล @ndlp.go.th": "Must use an @ndlp.go.th email address.",
  "อีเมลโรงเรียนต้องลงท้ายด้วย @chomthong.ac.th": "School email must end with @chomthong.ac.th.",
  "อีเมล NDLP ต้องลงท้ายด้วย @ndlp.go.th": "NDLP email must end with @ndlp.go.th.",
  "หากลืมอีเมล NDLP ให้ติดต่อครูวิทยา หรือครูธนา": "If you have forgotten your NDLP email, contact Kru Wittaya or Kru Thana.",
  "เลข 13 หลัก หรือ G ตามด้วยเลข 12 หลัก": "13 digits, or G followed by 12 digits",
  "เช่น 0812345678": "e.g. 0812345678",
  "เช่น 99/9": "e.g. 99/9",
  "เช่น นางสาวสมใจ ใจดี": "e.g. Ms. Somjai Jaidee",
  "ไม่บังคับ": "Optional",
  "ระบบเติมให้อัตโนมัติ": "Filled automatically",
  "iPad ที่เปิดให้ ม.1–ม.3": "iPads available for Grades 7–9",
  "iPad สำหรับ ม.4–ม.6": "iPads for Grades 10–12",
  "ขอความอนุเคราะห์ให้ท่านรับอุปกรณ์และเปิดใช้งานบัญชี NDLP ให้เรียบร้อยก่อน หากภายหลังยังประสงค์คืนอุปกรณ์ สามารถบันทึกแบบฟอร์มแจ้งคืนได้ภายหลัง": "Please receive the device and activate your NDLP account first. If you later wish to return it, you may submit a device return form.",
};

const phraseTranslations: Array<[RegExp, string]> = [
  [/^(\d+) รายการ$/, "$1 items"],
  [/^(\d+) รูป$/, "$1 images"],
  [/^รูปที่ (\d+)$/, "Image $1"],
  [/^เปิด (.+) รูปที่ (\d+)$/, "Open $1, image $2"],
  [/^ตัวอย่าง (.+)$/, "$1 preview"],
  [/^หมายเหตุ:\s*/, "Note: "],
  [/^ชั้น\s+/, "Grade "],
  [/\s+คน ลงทะเบียนแล้ว$/, " registered"],
  [/^ครู (\d+) คน/, "$1 teachers"],
  [/ลงทะเบียนแล้ว (\d+)/, "$1 registered"],
  [/^(\d+)% สำเร็จ$/, "$1% complete"],
  [/^(\d+) จาก (\d+) คน ลงทะเบียนแล้ว$/, "$1 of $2 registered"],
  [/^ลงทะเบียนรับแล้ว (\d+) เครื่อง จากทั้งหมด (\d+) เครื่อง$/, "$1 of $2 devices registered"],
  [/^ม\.ต้นเหลือ ([\d,]+) เครื่อง · ม\.ปลายเหลือ ([\d,]+) เครื่อง$/, "Lower secondary: $1 available · Upper secondary: $2 available"],
];

function translateTextValue(value: string) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.trim();
  if (!core) return value;
  let translated = translations[core];
  if (!translated) {
    translated = core;
    for (const [pattern, replacement] of phraseTranslations) {
      translated = translated.replace(pattern, replacement);
    }
  }
  return `${leading}${translated}${trailing}`;
}

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (thai: string, english: string) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: "th",
  setLanguage: () => undefined,
  t: (thai) => thai,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [language, setLanguageState] = useState<AppLanguage>("th");
  const [ready, setReady] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${COOKIE_KEY}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setShowPicker(false);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    queueMicrotask(() => {
      if (saved === "th" || saved === "en") setLanguageState(saved);
      else if (!pathname.startsWith("/admin")) setShowPicker(true);
      setReady(true);
    });
  }, [pathname]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    const titles: Record<AppLanguage, Record<string, string>> = {
      en: {
        "/": "iPad Loan Registration | Chomthong School",
        "/teacher": "Teacher iPad Registration | Chomthong School",
        "/student": "Student iPad Registration | Chomthong School",
        "/project": "News & Project Information | Chomthong School",
        "/admin/login": "Administrator Sign In | iPad Registration",
      },
      th: {
        "/": "ระบบลงทะเบียนรับ iPad ยืมเรียนฟรี สำหรับครูและนักเรียนโรงเรียนจอมทอง",
        "/teacher": "ลงทะเบียนรับ iPad สำหรับครู | ระบบลงทะเบียนรับ iPad",
        "/student": "ลงทะเบียนรับ iPad สำหรับนักเรียน | ระบบลงทะเบียนรับ iPad",
        "/project": "ประชาสัมพันธ์ | ระบบลงทะเบียนรับ iPad",
        "/admin/login": "เข้าสู่ระบบผู้ดูแล | ระบบลงทะเบียนรับ iPad",
      },
    };
    document.title = titles[language][pathname] ?? (language === "en" ? "iPad Registration Administration" : "ระบบจัดการลงทะเบียนรับ iPad");
    window.dispatchEvent(new CustomEvent("app-language-change", { detail: language }));
  }, [language, pathname]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (thai, english) => language === "en" ? english : thai,
  }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      <LegacyLanguageTranslator language={language} />
      {children}
      {ready && showPicker && (
        <div className="language-picker-backdrop">
          <section className="language-picker" role="dialog" aria-modal="true" aria-labelledby="language-picker-title">
            <span className="language-picker-icon"><FontAwesomeIcon icon={faGlobe} /></span>
            <h2 id="language-picker-title">เลือกภาษา <small>Choose your language</small></h2>
            <p>กรุณาเลือกภาษาที่ต้องการใช้<br/><span>Choose the language you want to use.</span></p>
            <div>
              <button type="button" onClick={() => setLanguage("th")}>
                <b>ไทย</b><span>ภาษาไทย</span><FontAwesomeIcon icon={faCheck}/>
              </button>
              <button type="button" onClick={() => setLanguage("en")}>
                <b>EN</b><span>English</span><FontAwesomeIcon icon={faCheck}/>
              </button>
            </div>
          </section>
        </div>
      )}
    </LanguageContext.Provider>
  );
}

function LegacyLanguageTranslator({ language }: { language: AppLanguage }) {
  const originals = useRef(new WeakMap<Node, string>());
  const attributeOriginals = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    let frame = 0;
    const attributes = ["placeholder", "aria-label", "title"];
    const translateTree = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style,[data-no-auto-translate]")) continue;
        const original = originals.current.get(node) ?? node.textContent ?? "";
        if (!originals.current.has(node)) originals.current.set(node, original);
        const next = language === "en" ? translateTextValue(original) : original;
        if (node.textContent !== next) node.textContent = next;
      }
      document.querySelectorAll("[placeholder],[aria-label],[title]").forEach((element) => {
        let saved = attributeOriginals.current.get(element);
        if (!saved) {
          saved = new Map();
          attributeOriginals.current.set(element, saved);
        }
        attributes.forEach((attribute) => {
          const current = element.getAttribute(attribute);
          if (current === null) return;
          if (!saved!.has(attribute)) saved!.set(attribute, current);
          const original = saved!.get(attribute)!;
          const next = language === "en" ? translateTextValue(original) : original;
          if (current !== next) element.setAttribute(attribute, next);
        });
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(translateTree);
    };
    translateTree();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [language]);
  return null;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div className={`language-switcher${compact ? " compact" : ""}`} role="group" aria-label={language === "en" ? "Language" : "ภาษา"}>
      <FontAwesomeIcon icon={faGlobe}/>
      <button type="button" className={language === "th" ? "active" : ""} onClick={() => setLanguage("th")} aria-pressed={language === "th"}>TH</button>
      <span>/</span>
      <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>EN</button>
    </div>
  );
}

export function translateLegacyText(value: string, language: AppLanguage) {
  return language === "en" ? translateTextValue(value) : value;
}
