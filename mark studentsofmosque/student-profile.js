(() => {
  const SESSION_KEY = "qobaa-admin-authenticated";
  const STUDENT_PROFILE_EDITS_KEY = "qobaa-student-profile-edits-v1";
  const EDITABLE_FIELDS = [
    { key: "fullName", label: "اسم الطالب الثلاثي", fallbackKey: "name" },
    { key: "fatherName", label: "اسم الأب" },
    { key: "motherName", label: "اسم الأم" },
    { key: "birthYear", label: "المواليد" },
    { key: "grade", label: "الصف" },
    { key: "schoolName", label: "المدرسة" },
    { key: "residence", label: "مكان السكن" },
    { key: "fatherPhone", label: "رقم والد الطالب", dir: "ltr" },
    { key: "motherPhone", label: "رقم والدة الطالب", dir: "ltr" },
    { key: "studentPhone", label: "رقم الطالب", dir: "ltr" },
    { key: "memorizationLevel", label: "مستوى الحفظ (الجزء)" },
  ];
  const dataset = window.QOBAA_STUDENT_RECORDS?.buildDataset()
    || window.STUDENT_INFO_DATA
    || { meta: {}, sections: [], columns: [], students: [] };
  const state = {
    isEditing: false,
    student: null,
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (sessionStorage.getItem(SESSION_KEY) !== "true") {
      renderLoginGate();
      return;
    }

    const studentId = new URLSearchParams(window.location.search).get("id") || "";
    const student = window.QOBAA_STUDENT_RECORDS?.findStudentById(studentId, dataset)
      || (dataset.students || []).find((item) => item.id === studentId);

    if (!student) {
      renderMissingStudent();
      return;
    }

    state.student = { ...student };
    bindProfileControls();
    renderStudentProfile();
  }

  function bindProfileControls() {
    document.getElementById("student-profile-edit-button")?.addEventListener("click", () => {
      state.isEditing = true;
      setMessage("");
      renderStudentProfile();
    });

    document.getElementById("student-profile-cancel-button")?.addEventListener("click", () => {
      state.isEditing = false;
      setMessage("");
      renderStudentProfile();
    });

    document.getElementById("student-profile-save-button")?.addEventListener("click", saveProfileChanges);
  }

  function renderLoginGate() {
    const main = document.getElementById("student-profile-main");
    if (!main) return;

    main.innerHTML = `
      <section class="login-panel student-info-gate">
        <div class="title-block">
          <p class="eyebrow">منطقة الإدارة</p>
          <h1>ملف الطالب</h1>
          <p class="lead">يرجى تسجيل الدخول من لوحة الإدارة لعرض ملف الطالب.</p>
        </div>
        <a class="primary-button" href="admin.html">دخول الإدارة</a>
      </section>
    `;
  }

  function renderMissingStudent() {
    const main = document.getElementById("student-profile-main");
    if (!main) return;

    main.innerHTML = `
      <section class="student-profile-panel student-profile-missing">
        <div class="title-block">
          <p class="eyebrow">ملف الطالب</p>
          <h1>لم يتم العثور على الطالب</h1>
          <p class="lead">قد يكون الرابط غير مكتمل أو تم تعديل بيانات الطالب.</p>
        </div>
        <a class="secondary-button" href="students.html">رجوع إلى بيانات الطلاب</a>
      </section>
    `;
  }

  function renderStudentProfile() {
    const student = state.student;
    if (!student) return;

    const title = document.getElementById("student-profile-title");
    const subtitle = document.getElementById("student-profile-subtitle");
    const ringLink = document.getElementById("student-profile-ring-link");
    const infoGrid = document.getElementById("student-profile-info-grid");

    if (title) title.textContent = getDisplayName(student);
    if (subtitle) {
      subtitle.textContent = [student.sectionName, student.school].filter(Boolean).join(" | ") || "-";
    }

    setText("student-profile-ring", student.sectionName || "-");
    setText("student-profile-teacher", student.school || "-");
    setText("student-profile-category", student.category || "-");
    setText("student-profile-grade", student.grade || "-");

    if (ringLink && student.ringId) {
      ringLink.href = `rings.html#${encodeURIComponent(student.ringId)}`;
    }

    if (infoGrid) {
      infoGrid.innerHTML = state.isEditing
        ? renderEditForm(student)
        : getStudentFields(student).map(renderField).join("");
    }

    updateEditControls();
  }

  function getStudentFields(student) {
    return EDITABLE_FIELDS.map((field) => ({
      ...field,
      value: getFieldValue(student, field),
    }));
  }

  function getFieldValue(student, field) {
    return student[field.key] || (field.fallbackKey ? student[field.fallbackKey] : "") || "";
  }

  function renderField(field) {
    return `
      <div class="student-profile-field">
        <span>${escapeHtml(field.label)}</span>
        <strong class="${field.value ? "" : "empty-value"}"${field.dir ? ` dir="${field.dir}"` : ""}>${field.value ? escapeHtml(field.value) : "بانتظار الإدخال"}</strong>
      </div>
    `;
  }

  function renderEditForm(student) {
    return `
      <form class="student-profile-edit-form" id="student-profile-edit-form">
        ${getStudentFields(student).map(renderEditField).join("")}
      </form>
    `;
  }

  function renderEditField(field) {
    return `
      <label class="student-profile-edit-field">
        <span>${escapeHtml(field.label)}</span>
        <input name="${escapeHtml(field.key)}" type="text" value="${escapeHtml(field.value)}"${field.dir ? ` dir="${field.dir}"` : ""} autocomplete="off">
      </label>
    `;
  }

  function saveProfileChanges() {
    const form = document.getElementById("student-profile-edit-form");
    if (!form || !state.student) return;

    const formData = new FormData(form);
    const updates = {};
    EDITABLE_FIELDS.forEach((field) => {
      updates[field.key] = String(formData.get(field.key) || "").trim();
    });

    if (window.QOBAA_STUDENT_RECORDS?.saveStudentProfileEdits) {
      window.QOBAA_STUDENT_RECORDS.saveStudentProfileEdits(state.student.id, updates);
    } else {
      saveStudentProfileEdits(state.student.id, updates);
    }

    state.student = applyStudentProfileEdits(state.student, updates);
    state.isEditing = false;
    renderStudentProfile();
    setMessage("تم حفظ معلومات الطالب بنجاح.");
  }

  function updateEditControls() {
    const editButton = document.getElementById("student-profile-edit-button");
    const saveButton = document.getElementById("student-profile-save-button");
    const cancelButton = document.getElementById("student-profile-cancel-button");

    if (editButton) editButton.hidden = state.isEditing;
    if (saveButton) saveButton.hidden = !state.isEditing;
    if (cancelButton) cancelButton.hidden = !state.isEditing;
  }

  function applyStudentProfileEdits(student, edits) {
    if (window.QOBAA_STUDENT_RECORDS?.applyStudentProfileEdits) {
      return window.QOBAA_STUDENT_RECORDS.applyStudentProfileEdits(student, edits);
    }

    const merged = { ...student, ...edits };
    if (edits.fullName) merged.name = edits.fullName;
    if (edits.fatherPhone) merged.phone = edits.fatherPhone;
    return merged;
  }

  function saveStudentProfileEdits(studentId, updates) {
    if (!studentId) return;

    const edits = readJsonStorage(STUDENT_PROFILE_EDITS_KEY);
    edits[studentId] = {
      ...(edits[studentId] || {}),
      ...updates,
    };
    localStorage.setItem(STUDENT_PROFILE_EDITS_KEY, JSON.stringify(edits));
  }

  function readJsonStorage(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch {
      return {};
    }
  }

  function getDisplayName(student) {
    return student.fullName || student.name || "-";
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setMessage(message) {
    const element = document.getElementById("student-profile-message");
    if (element) element.textContent = message || "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
