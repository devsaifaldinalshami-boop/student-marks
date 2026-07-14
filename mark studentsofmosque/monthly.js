(() => {
  const SESSION_KEY = "qobaa-admin-authenticated";
  const DEFAULT_PROBE_STAGE = "سبر مرحلي";
  const DEFAULT_PROBE_PART = "عم";
  const CUSTOM_PROBE_PART = "غير ذلك";
  const PROBE_STAGE_OPTIONS = ["سبر مرحلي", "سبر مركزي"];
  const PROBE_PART_OPTIONS = [
    "عم",
    "عم وتبارك",
    "اول ثلاث اجزاء",
    "اخر ثلاث اجزاء",
    "اول خمسة اجزاء",
    "تاني خمسة اجزاء",
    "ثالث خمسة اجزاء",
    "رابع خمسة اجزاء",
    "خامس خمسة اجزاء",
    "سادس خمسة اجزاء",
    "اول 10 اجزاء",
    "تاني 10 اجزاء",
    "ثالث 10 اجزاء",
    "نصف القرآن",
    "اول 20 جزء",
    CUSTOM_PROBE_PART,
  ];
  const dataset = window.QOBAA_STUDENT_RECORDS?.buildDataset()
    || window.STUDENT_INFO_DATA
    || { meta: {}, sections: [], columns: [], students: [] };
  const state = {
    query: "",
    defaultStage: DEFAULT_PROBE_STAGE,
    ring: "",
    category: "",
    teacher: "",
    selected: new Set(),
    probeSettings: new Map(),
  };

  document.addEventListener("DOMContentLoaded", init);

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing-monthly-probe");
    const printRoot = document.getElementById("monthly-probe-print-root");
    if (printRoot) {
      printRoot.innerHTML = "";
    }
  });

  function init() {
    if (sessionStorage.getItem(SESSION_KEY) !== "true") {
      renderLoginGate();
      return;
    }

    populateFilters();
    bindControls();
    renderMeta();
    renderRows();
  }

  function renderLoginGate() {
    const main = document.getElementById("monthly-probe-main");
    if (!main) return;

    main.innerHTML = `
      <section class="login-panel monthly-probe-gate">
        <div class="title-block">
          <p class="eyebrow">منطقة الإدارة</p>
          <h1>السبر الشهري</h1>
          <p class="lead">يرجى تسجيل الدخول من لوحة الإدارة لعرض صفحة السبر الشهري.</p>
        </div>
        <a class="primary-button" href="admin.html">دخول الإدارة</a>
      </section>
    `;
  }

  function populateFilters() {
    fillSelect("monthly-probe-ring-filter", uniqueValues(dataset.students, "sectionName"), "كل الحلقات");
    fillSelect("monthly-probe-category-filter", uniqueValues(dataset.students, "category"), "كل الفئات");
    fillSelect("monthly-probe-teacher-filter", uniqueValues(dataset.students, "school"), "كل المدرسين");
  }

  function bindControls() {
    const search = document.getElementById("monthly-probe-search");
    const stage = document.getElementById("monthly-probe-stage");
    const ring = document.getElementById("monthly-probe-ring-filter");
    const category = document.getElementById("monthly-probe-category-filter");
    const teacher = document.getElementById("monthly-probe-teacher-filter");
    const selectVisible = document.getElementById("monthly-probe-select-visible");
    const clearSelection = document.getElementById("monthly-probe-clear-selection");
    const printButton = document.getElementById("monthly-probe-print-button");
    const tableBody = document.getElementById("monthly-probe-table-body");

    search?.addEventListener("input", () => {
      state.query = search.value.trim();
      renderRows();
    });

    stage?.addEventListener("change", () => {
      state.defaultStage = stage.value || DEFAULT_PROBE_STAGE;
      renderMeta();
    });

    ring?.addEventListener("change", () => {
      state.ring = ring.value;
      renderRows();
    });

    category?.addEventListener("change", () => {
      state.category = category.value;
      renderRows();
    });

    teacher?.addEventListener("change", () => {
      state.teacher = teacher.value;
      renderRows();
    });

    selectVisible?.addEventListener("click", () => {
      getFilteredStudents().forEach((student) => {
        state.selected.add(student.id);
        ensureProbeSettings(student);
      });
      renderRows();
    });

    clearSelection?.addEventListener("click", () => {
      state.selected.clear();
      renderRows();
    });

    printButton?.addEventListener("click", printSelectedStudents);

    tableBody?.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-monthly-student]");
      if (checkbox) {
        if (checkbox.checked) {
          state.selected.add(checkbox.dataset.monthlyStudent);
          ensureProbeSettings(findStudentById(checkbox.dataset.monthlyStudent) || checkbox.dataset.monthlyStudent);
        } else {
          state.selected.delete(checkbox.dataset.monthlyStudent);
        }
        renderMeta();
        return;
      }

      const stageSelect = event.target.closest("[data-monthly-stage]");
      if (stageSelect) {
        ensureProbeSettings(stageSelect.dataset.monthlyStage).stage = stageSelect.value || DEFAULT_PROBE_STAGE;
        renderMeta();
        return;
      }

      const partSelect = event.target.closest("[data-monthly-part]");
      if (partSelect) {
        const settings = ensureProbeSettings(partSelect.dataset.monthlyPart);
        settings.part = partSelect.value || DEFAULT_PROBE_PART;
        renderRows();
      }
    });

    tableBody?.addEventListener("input", (event) => {
      const customInput = event.target.closest("[data-monthly-custom-part]");
      if (!customInput) return;

      ensureProbeSettings(customInput.dataset.monthlyCustomPart).customPart = customInput.value.trim();
    });
  }

  function renderMeta() {
    setText("monthly-probe-count", String((dataset.students || []).length));
    setText("monthly-probe-selected-count", String(state.selected.size));
    setText("monthly-probe-rings-count", String(uniqueValues(dataset.students, "sectionName").length));
    setText("monthly-probe-stage-summary", getSelectedStageSummary());
  }

  function renderRows() {
    const body = document.getElementById("monthly-probe-table-body");
    const summary = document.getElementById("monthly-probe-result-summary");
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
          <td class="monthly-probe-empty-cell" colspan="10">لا توجد بيانات مطابقة لخيارات البحث الحالية.</td>
        </tr>
      `;
      renderMeta();
      return;
    }

    body.innerHTML = students.map(renderStudentRow).join("");
    renderMeta();
  }

  function renderStudentRow(student) {
    const checked = state.selected.has(student.id) ? " checked" : "";
    const settings = getProbeSettings(student);
    const customPartEnabled = settings.part === CUSTOM_PROBE_PART;
    return `
      <tr>
        <td class="monthly-probe-select-cell">
          <input type="checkbox" data-monthly-student="${escapeHtml(student.id)}"${checked} aria-label="اختيار ${escapeHtml(getStudentName(student))}">
        </td>
        <td>${escapeHtml(student.serial || "-")}</td>
        <td class="name-cell"><strong>${escapeHtml(getStudentName(student))}</strong></td>
        <td>${renderValue(student.sectionName)}</td>
        <td>${renderValue(student.school)}</td>
        <td>${renderValue(student.fatherName)}</td>
        <td>${renderValue(student.birthYear)}</td>
        <td dir="ltr">${renderValue(student.fatherPhone)}</td>
        <td>
          <select class="monthly-probe-inline-select" data-monthly-stage="${escapeHtml(student.id)}" aria-label="نوع السبر للطالب ${escapeHtml(getStudentName(student))}">
            ${renderOptions(PROBE_STAGE_OPTIONS, settings.stage)}
          </select>
        </td>
        <td class="monthly-probe-part-cell">
          <select class="monthly-probe-inline-select" data-monthly-part="${escapeHtml(student.id)}" aria-label="الجزء المطلوب للطالب ${escapeHtml(getStudentName(student))}">
            ${renderOptions(PROBE_PART_OPTIONS, settings.part)}
          </select>
          <input
            class="monthly-probe-custom-part"
            type="text"
            value="${escapeHtml(settings.customPart)}"
            placeholder="اكتب الجزء"
            data-monthly-custom-part="${escapeHtml(student.id)}"
            ${customPartEnabled ? "" : "disabled"}
          >
        </td>
      </tr>
    `;
  }

  function getFilteredStudents() {
    const query = normalize(state.query);
    return (dataset.students || []).filter((student) => {
      const matchesRing = !state.ring || student.sectionName === state.ring;
      const matchesCategory = !state.category || student.category === state.category;
      const matchesTeacher = !state.teacher || student.school === state.teacher;
      const queryText = [
        student.name,
        student.fullName,
        student.sectionName,
        student.school,
        student.category,
        student.grade,
        student.fatherName,
        student.birthYear,
        student.fatherPhone,
        student.memorizationLevel,
      ].join(" ");
      const matchesQuery = !query || normalize(queryText).includes(query);
      return matchesRing && matchesCategory && matchesTeacher && matchesQuery;
    });
  }

  function getSelectedStudents() {
    const selectedIds = state.selected;
    return (dataset.students || []).filter((student) => selectedIds.has(student.id));
  }

  function printSelectedStudents() {
    const selectedStudents = getSelectedStudents();
    if (!selectedStudents.length) {
      alert("اختر طالباً واحداً على الأقل قبل تحويل الكشف إلى PDF.");
      return;
    }

    const printRoot = document.getElementById("monthly-probe-print-root");
    if (!printRoot) return;

    printRoot.innerHTML = buildMonthlyProbePrintReport(selectedStudents);
    document.body.classList.add("printing-monthly-probe");
    setTimeout(() => window.print(), 80);
  }

  function buildMonthlyProbePrintReport(students) {
    const rows = students.map((student, index) => {
      const settings = getProbeSettings(student);
      return `
        <tr>
          <td>${(index + 1).toLocaleString("ar-SY")}</td>
        <td><strong>${escapeHtml(getStudentName(student))}</strong></td>
          <td>${escapeHtml(student.sectionName || "-")}</td>
          <td>${escapeHtml(student.school || "-")}</td>
          <td>${escapeHtml(student.fatherName || "-")}</td>
          <td>${escapeHtml(student.birthYear || "-")}</td>
          <td dir="ltr">${escapeHtml(student.fatherPhone || "-")}</td>
          <td>${escapeHtml(settings.stage || DEFAULT_PROBE_STAGE)}</td>
          <td>${escapeHtml(getProbePartText(settings))}</td>
        </tr>
      `;
    }).join("");

    return `
      <article class="print-report monthly-probe-print-report">
        <section class="print-sheet monthly-probe-print-sheet">
          <header class="print-header">
            <div class="print-brand-copy">
              <h1>مسجد قباء</h1>
              <p>كشف السبر الشهري</p>
            </div>
            <img class="print-logo" src="assets/qobaa-logo-vertical.png" alt="شعار مسجد قباء">
            <div class="print-header-spacer" aria-hidden="true"></div>
          </header>

          <div class="monthly-probe-print-title">
            <p>اختبارات شهرية</p>
            <h2>كشف السبر الشهري</h2>
          </div>

          <div class="ranking-print-summary monthly-probe-print-summary">
            <div><strong>أنواع السبر:</strong> ${escapeHtml(getSelectedStageSummary(students))}</div>
            <div><strong>عدد الطلاب المختارين:</strong> ${students.length.toLocaleString("ar-SY")}</div>
            <div><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString("ar-SY")}</div>
          </div>

          <table class="print-table monthly-probe-print-table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>اسم الطالب</th>
                <th>الحلقة</th>
                <th>استاذ الحلقة</th>
                <th>اسم الأب</th>
                <th>المواليد</th>
                <th>رقم الأب</th>
                <th>نوع السبر</th>
                <th>الجزء</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      </article>
    `;
  }

  function findStudentById(studentId) {
    return (dataset.students || []).find((student) => student.id === studentId) || null;
  }

  function getDefaultProbeSettings(studentOrId) {
    const student = typeof studentOrId === "string" ? findStudentById(studentOrId) : studentOrId;
    const importedPart = String(student?.memorizationLevel || "").trim();
    if (!importedPart) {
      return {
        stage: state.defaultStage || DEFAULT_PROBE_STAGE,
        part: DEFAULT_PROBE_PART,
        customPart: "",
      };
    }

    const directOption = PROBE_PART_OPTIONS.find((option) => normalize(option) === normalize(importedPart));
    if (directOption) {
      return {
        stage: state.defaultStage || DEFAULT_PROBE_STAGE,
        part: directOption,
        customPart: "",
      };
    }

    return {
      stage: state.defaultStage || DEFAULT_PROBE_STAGE,
      part: CUSTOM_PROBE_PART,
      customPart: importedPart,
    };
  }

  function getProbeSettings(studentOrId) {
    const studentId = typeof studentOrId === "string" ? studentOrId : studentOrId?.id;
    return state.probeSettings.get(studentId) || getDefaultProbeSettings(studentOrId);
  }

  function ensureProbeSettings(studentOrId) {
    const studentId = typeof studentOrId === "string" ? studentOrId : studentOrId?.id;
    if (!studentId) {
      return {
        stage: state.defaultStage || DEFAULT_PROBE_STAGE,
        part: DEFAULT_PROBE_PART,
        customPart: "",
      };
    }

    if (!state.probeSettings.has(studentId)) {
      state.probeSettings.set(studentId, getDefaultProbeSettings(studentOrId));
    }
    return state.probeSettings.get(studentId);
  }

  function getProbePartText(settings) {
    if (settings.part === CUSTOM_PROBE_PART) {
      return settings.customPart?.trim() || CUSTOM_PROBE_PART;
    }
    return settings.part || DEFAULT_PROBE_PART;
  }

  function getSelectedStageSummary(students = getSelectedStudents()) {
    if (!students.length) return "حسب اختيار الطلاب";

    const counts = new Map(PROBE_STAGE_OPTIONS.map((stage) => [stage, 0]));
    students.forEach((student) => {
      const stage = getProbeSettings(student).stage || DEFAULT_PROBE_STAGE;
      counts.set(stage, (counts.get(stage) || 0) + 1);
    });

    return [...counts.entries()]
      .filter(([, count]) => count)
      .map(([stage, count]) => `${stage}: ${count.toLocaleString("ar-SY")}`)
      .join(" | ");
  }

  function renderOptions(options, selectedValue) {
    return options.map((option) => `
      <option value="${escapeHtml(option)}"${option === selectedValue ? " selected" : ""}>${escapeHtml(option)}</option>
    `).join("");
  }

  function renderValue(value) {
    return value ? escapeHtml(value) : '<span class="monthly-probe-muted">-</span>';
  }

  function getStudentName(student) {
    return student.fullName || student.name || "-";
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
})();
