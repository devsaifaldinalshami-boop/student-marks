(() => {
  const SESSION_KEY = "qobaa-admin-authenticated";
  const RING_NAME_EDITS_KEY = "qobaa-mosque-ring-name-edits-v1";
  const RING_STUDENTS_KEY = "qobaa-mosque-ring-students-v1";
  const baseStudentInfo = window.STUDENT_INFO_DATA || { meta: {}, sections: [], columns: [], students: [] };
  const dataset = window.QOBAA_STUDENT_RECORDS?.buildDataset() || buildDatasetFromRings() || baseStudentInfo;
  const state = {
    query: "",
    section: "",
    grade: "",
    school: "",
  };

  document.addEventListener("DOMContentLoaded", init);

  function buildDatasetFromRings() {
    const ringsDataset = window.MOSQUE_RINGS_DATA;
    if (!ringsDataset || !Array.isArray(ringsDataset.rings)) return null;

    const nameEdits = readJsonStorage(RING_NAME_EDITS_KEY);
    const localStudentsByRing = readJsonStorage(RING_STUDENTS_KEY);
    const baseStudentsByRing = ringsDataset.studentsByRing || {};
    const columns = baseStudentInfo.columns && baseStudentInfo.columns.length
      ? baseStudentInfo.columns
      : getDefaultStudentInfoColumns();
    const sections = [];
    const students = [];

    ringsDataset.rings.forEach((ring) => {
      const baseStudents = (baseStudentsByRing[ring.id] || []).map((student, index) => ({
        ...student,
        id: student.id || `${ring.id}-file-${index + 1}`,
        source: student.source || "file",
      }));
      const localStudents = (localStudentsByRing[ring.id] || []).map((student, index) => ({
        ...student,
        id: student.id || `${ring.id}-local-${index + 1}`,
        source: student.source || "local",
      }));
      const ringStudents = [...baseStudents, ...localStudents]
        .map((student) => ({
          ...student,
          name: String(student.name || "").trim(),
        }))
        .filter((student) => student.name);

      if (!ringStudents.length) return;

      const fallbackName = `حلقة ${ring.teacher || ring.order || ""}`.trim();
      const sectionName = nameEdits[ring.id] || ring.name || fallbackName;
      sections.push({
        id: ring.id,
        name: sectionName,
        teacher: ring.teacher || "",
        category: ring.category || "",
        grade: ring.grade || "",
        total: ringStudents.length,
      });

      ringStudents.forEach((student) => {
        students.push({
          id: student.id,
          ringId: ring.id,
          serial: String(students.length + 1),
          name: student.name,
          sectionName,
          school: ring.teacher || "",
          category: ring.category || "",
          grade: ring.grade || "",
          notes: student.source === "local" ? "من الإضافة اليدوية" : "من حلقات المسجد",
        });
      });
    });

    return {
      meta: {
        ...(baseStudentInfo.meta || {}),
        source: "حلقات المسجد",
        sourceUrl: "rings.html",
        totalStudents: students.length,
        totalSections: sections.length,
      },
      sections,
      columns,
      students,
    };
  }

  function getDefaultStudentInfoColumns() {
    return [
      { key: "serial", label: "الرقم" },
      { key: "name", label: "اسم الطالب" },
      { key: "sectionName", label: "الحلقة" },
      { key: "school", label: "المدرس" },
      { key: "category", label: "الفئة" },
      { key: "grade", label: "الصف" },
      { key: "notes", label: "المصدر" },
    ];
  }

  function readJsonStorage(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch {
      return {};
    }
  }

  function init() {
    if (sessionStorage.getItem(SESSION_KEY) !== "true") {
      renderLoginGate();
      return;
    }

    renderMeta();
    renderTableHead();
    populateFilters();
    bindControls();
    renderRows();
  }

  function renderLoginGate() {
    const main = document.getElementById("student-info-main");
    if (!main) return;

    main.innerHTML = `
      <section class="login-panel student-info-gate">
        <div class="title-block">
          <p class="eyebrow">منطقة الإدارة</p>
          <h1>بيانات الطلاب</h1>
          <p class="lead">يرجى تسجيل الدخول من لوحة الإدارة لعرض بيانات الطلاب.</p>
        </div>
        <a class="primary-button" href="admin.html">دخول الإدارة</a>
      </section>
    `;
  }

  function renderMeta() {
    const students = dataset.students || [];
    const meta = dataset.meta || {};
    const sections = dataset.sections || [];
    const schoolCount = uniqueValues(students, "school").length;
    const grades = uniqueValues(students, "grade");
    const gradeSummary = grades.length ? grades.join("، ") : "-";

    setText("student-info-count", String(students.length));
    setText("student-info-grade-summary", gradeSummary || "-");
    setText("student-info-teacher", sections.length ? `${sections.length} حلقات` : "-");
    setText("student-info-school-count", String(schoolCount));

    const sourceLink = document.getElementById("student-info-source-link");
    if (sourceLink && meta.sourceUrl) {
      sourceLink.href = meta.sourceUrl;
    }

    const editLink = document.getElementById("student-info-edit-link");
    if (editLink && meta.sourceUrl) {
      editLink.href = meta.sourceUrl;
    }
  }

  function renderTableHead() {
    const head = document.getElementById("student-info-table-head");
    if (!head) return;

    head.innerHTML = `
      <tr>
        ${getColumns().map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
      </tr>
    `;
  }

  function populateFilters() {
    const sectionNames = (dataset.sections || []).map((section) => section.name).filter(Boolean);
    fillSelect(
      "student-info-section-filter",
      sectionNames.length ? sectionNames : uniqueValues(dataset.students, "sectionName"),
      "كل الحلقات"
    );
    fillSelect("student-info-grade-filter", uniqueValues(dataset.students, "grade"), "كل الصفوف");
    fillSelect("student-info-school-filter", uniqueValues(dataset.students, "school"), "كل المدرسين");
  }

  function bindControls() {
    const search = document.getElementById("student-info-search");
    const section = document.getElementById("student-info-section-filter");
    const grade = document.getElementById("student-info-grade-filter");
    const school = document.getElementById("student-info-school-filter");
    const pdfButton = document.getElementById("student-info-pdf-button");

    search?.addEventListener("input", () => {
      state.query = search.value.trim();
      renderRows();
    });

    section?.addEventListener("change", () => {
      state.section = section.value;
      renderRows();
    });

    grade?.addEventListener("change", () => {
      state.grade = grade.value;
      renderRows();
    });

    school?.addEventListener("change", () => {
      state.school = school.value;
      renderRows();
    });

    pdfButton?.addEventListener("click", printStudentInfoPdf);
  }

  function renderRows() {
    const body = document.getElementById("student-info-table-body");
    const summary = document.getElementById("student-info-result-summary");
    if (!body) return;

    const students = getFilteredStudents();
    if (summary) {
      summary.textContent = students.length
        ? `يتم عرض ${students.length} من أصل ${(dataset.students || []).length} طالب`
        : "لا توجد نتائج مطابقة";
    }

    if (!students.length) {
      body.innerHTML = `
        <tr>
          <td class="student-info-empty" colspan="${getColumns().length}">لا توجد بيانات مطابقة لخيارات البحث الحالية.</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = students.map(renderStudentRow).join("");
  }

  function renderStudentRow(student) {
    return `
      <tr>
        ${getColumns().map((column) => renderCell(student, column.key)).join("")}
      </tr>
    `;
  }

  function renderCell(student, key) {
    const rawValue = student[key] || "";
    const value = rawValue ? escapeHtml(rawValue) : '<span class="muted-value">-</span>';

    if (key === "name") {
      const profileUrl = `student-profile.html?id=${encodeURIComponent(student.id || "")}`;
      return `<td class="name-cell"><a class="student-profile-link" href="${profileUrl}">${value}</a></td>`;
    }

    if (key.includes("Phone")) {
      return `<td><span class="student-info-phone" dir="ltr">${value}</span></td>`;
    }

    if (key === "notes") {
      return `<td><span class="student-info-note">${value}</span></td>`;
    }

    return `<td>${value}</td>`;
  }

  function getFilteredStudents() {
    const query = normalize(state.query);
    return (dataset.students || []).filter((student) => {
      const matchesSection = !state.section || student.sectionName === state.section;
      const matchesGrade = !state.grade || student.grade === state.grade;
      const matchesSchool = !state.school || student.school === state.school;
      const matchesQuery = !query || normalize(Object.values(student).join(" ")).includes(query);
      return matchesSection && matchesGrade && matchesSchool && matchesQuery;
    });
  }

  function printStudentInfoPdf() {
    const printRoot = document.getElementById("student-info-print-root");
    if (!printRoot) return;

    const students = getFilteredStudents();
    printRoot.innerHTML = buildStudentInfoPrintReport(students);
    document.body.classList.add("printing-student-info");
    setTimeout(() => window.print(), 80);
  }

  function buildStudentInfoPrintReport(students) {
    const filters = getActiveFilterSummary();
    const columns = getPrintColumns();
    const rows = students.length
      ? students.map((student, index) => `
        <tr>
          ${columns.map((column) => renderPrintCell(student, column.key, index)).join("")}
        </tr>
      `).join("")
      : `
        <tr>
          <td colspan="${columns.length}" class="student-info-print-empty">لا توجد بيانات مطابقة للفلاتر الحالية.</td>
        </tr>
      `;

    return `
      <section class="student-info-print-sheet" dir="rtl">
        <header class="student-info-print-header">
          <div>
            <p>مسجد قباء</p>
            <h1>بيانات الطلاب</h1>
            <span>${escapeHtml(filters)}</span>
          </div>
          <img src="assets/qobaa-logo.png" alt="">
        </header>

        <div class="student-info-print-summary">
          <span>عدد الطلاب: <strong>${students.length}</strong></span>
          <span>عدد الحلقات: <strong>${(dataset.sections || []).length}</strong></span>
          <span>عدد المدرسين: <strong>${uniqueValues(students, "school").length}</strong></span>
        </div>

        <table class="student-info-print-table">
          <thead>
            <tr>
              ${columns.map((column) => `<th class="student-info-print-${escapeHtml(column.key)}">${escapeHtml(column.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `;
  }

  function getPrintColumns() {
    return [
      { key: "serial", label: "الرقم" },
      { key: "name", label: "اسم الطالب" },
      { key: "fatherName", label: "اسم الأب" },
      { key: "motherName", label: "اسم الأم" },
      { key: "birthYear", label: "المواليد" },
      { key: "grade", label: "الصف" },
      { key: "sectionName", label: "الحلقة" },
      { key: "school", label: "المدرس" },
      { key: "schoolName", label: "المدرسة" },
      { key: "residence", label: "مكان السكن" },
      { key: "fatherPhone", label: "رقم الأب" },
      { key: "motherPhone", label: "رقم الأم" },
      { key: "studentPhone", label: "رقم الطالب" },
      { key: "memorizationLevel", label: "مستوى الحفظ" },
      { key: "notes", label: "الملاحظات" },
    ];
  }

  function renderPrintCell(student, key, index) {
    const value = getPrintValue(student, key, index);
    const direction = key.includes("Phone") ? ' dir="ltr"' : "";
    return `<td class="student-info-print-${escapeHtml(key)}"${direction}>${value ? escapeHtml(value) : "-"}</td>`;
  }

  function getPrintValue(student, key, index) {
    if (key === "serial") return student.serial || String(index + 1);
    if (key === "name") return student.fullName || student.name || "";
    return student[key] || "";
  }

  function getActiveFilterSummary() {
    const parts = [];
    if (state.section) parts.push(`الحلقة: ${state.section}`);
    if (state.grade) parts.push(`الصف: ${state.grade}`);
    if (state.school) parts.push(`المدرس: ${state.school}`);
    if (state.query) parts.push(`البحث: ${state.query}`);
    return parts.length ? parts.join(" | ") : "كل الطلاب";
  }

  function getColumns() {
    return dataset.columns && dataset.columns.length
      ? dataset.columns
      : getDefaultStudentInfoColumns();
  }

  function fillSelect(id, values, placeholder) {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = [
      `<option value="">${escapeHtml(placeholder)}</option>`,
      ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
    ].join("");
  }

  function uniqueValues(items = [], key) {
    return [...new Set(items.map((item) => item[key]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "ar"));
  }

  function normalize(value) {
    return String(value || "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing-student-info");
    const printRoot = document.getElementById("student-info-print-root");
    if (printRoot) {
      printRoot.innerHTML = "";
    }
  });
})();
