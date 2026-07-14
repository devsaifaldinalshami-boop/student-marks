(function () {
  "use strict";

  const STORAGE_KEY = "qobaa-student-results-v9";
  const LEGACY_STORAGE_KEYS = ["qobaa-student-results-v1", "qobaa-student-results-v2", "qobaa-student-results-v3", "qobaa-student-results-v4", "qobaa-student-results-v5", "qobaa-student-results-v6", "qobaa-student-results-v7", "qobaa-student-results-v8"];
  const SESSION_KEY = "qobaa-admin-authenticated";
  const ADMIN_GROUPS = ["صف سابع وثامن", "صف سادس", "صف خامس"];
  const DEFAULT_ADMIN_GROUP = ADMIN_GROUPS[0];
  const SIXTH_GROUP = ADMIN_GROUPS[1];
  const FIFTH_GROUP = ADMIN_GROUPS[2];
  const defaultData = window.STUDENT_RESULTS || { settings: {}, students: [] };

  clearLegacyStorage();

  let state = loadState();
  let selectedStudentId = state.students[0] ? state.students[0].id : null;
  let activeAdminGroup = DEFAULT_ADMIN_GROUP;

  document.addEventListener("DOMContentLoaded", () => {
    applyBrand();

    const page = document.body.dataset.page;
    if (page === "home") {
      initHomePage();
    }
    if (page === "admin") {
      initAdminPage();
    }

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("printing");
      document.body.classList.remove("printing-landscape");
      const printRoot = document.getElementById("print-root");
      if (printRoot) {
        printRoot.innerHTML = "";
      }
    });
  });

  function loadState() {
    const base = cloneData(defaultData);
    const baseVersion = getDataVersion(base);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.students)) {
        if (getDataVersion(saved) !== baseVersion) {
          localStorage.removeItem(STORAGE_KEY);
          return {
            settings: { ...base.settings },
            students: base.students.map(normalizeStudent)
          };
        }
        return {
          settings: { ...base.settings, ...(saved.settings || {}) },
          students: saved.students.map(normalizeStudent)
        };
      }
    } catch (error) {
      console.warn("تعذر تحميل البيانات المحلية", error);
    }
    return {
      settings: { ...base.settings },
      students: base.students.map(normalizeStudent)
    };
  }

  function getDataVersion(data) {
    return (data && data.settings && data.settings.dataVersion) || "";
  }

  function clearLegacyStorage() {
    try {
      LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.warn("تعذر حذف البيانات القديمة", error);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state, null, 2));
    applyBrand();
  }

  function resetState() {
    localStorage.removeItem(STORAGE_KEY);
    state = {
      settings: { ...(defaultData.settings || {}) },
      students: (defaultData.students || []).map(normalizeStudent)
    };
    selectedStudentId = state.students[0] ? state.students[0].id : null;
    applyBrand();
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function normalizeStudent(student) {
    return {
      id: student.id || createId(),
      name: student.name || "",
      className: student.className || "",
      section: student.section || "",
      gradeGroup: student.gradeGroup || inferGradeGroup(student),
      notes: student.notes || "",
      subjects: Array.isArray(student.subjects) ? student.subjects.map(normalizeSubject) : []
    };
  }

  function inferGradeGroup(student) {
    const text = `${student.className || ""} ${student.section || ""}`;
    if (text.includes("الخامس")) return FIFTH_GROUP;
    return text.includes("السادس") || text.includes("الفئة الثانية") ? SIXTH_GROUP : DEFAULT_ADMIN_GROUP;
  }

  function normalizeSubject(subject) {
    return {
      name: normalizeSubjectName(subject.name),
      score: numberOrZero(subject.score),
      max: numberOrDefault(subject.max, 100),
      includedInTotal: subject.includedInTotal !== false
    };
  }

  function normalizeSubjectName(name) {
    return (name || "").replace(/محلصة المذاكرات/g, "محصلة المذاكرات");
  }

  function getAdminGroup(student) {
    return student.gradeGroup || inferGradeGroup(student);
  }

  function getActiveAdminStudents() {
    return state.students.filter((student) => getAdminGroup(student) === activeAdminGroup);
  }

  function ensureSelectedStudentInActiveGroup() {
    const activeStudents = getActiveAdminStudents();
    if (!activeStudents.some((student) => student.id === selectedStudentId)) {
      selectedStudentId = activeStudents[0] ? activeStudents[0].id : null;
    }
  }

  function createId() {
    return "student-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function normalizeArabic(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ـ/g, "")
      .replace(/[^\u0600-\u06FFa-z0-9]/g, "");
  }

  function arabicTokens(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ـ/g, "")
      .split(/[^\u0600-\u06FFa-z0-9]+/)
      .filter(Boolean);
  }

  function findStudents(query, collection = state.students) {
    const normalizedQuery = normalizeArabic(query);
    const queryTokens = arabicTokens(query);
    if (!normalizedQuery) {
      return [];
    }
    return collection
      .map((student) => {
        const name = normalizeArabic(student.name);
        const section = normalizeArabic(student.section);
        const searchable = `${student.name} ${student.section} ${student.className}`;
        const searchableCompact = normalizeArabic(searchable);
        const tokenMatch = queryTokens.every((token) => searchableCompact.includes(token));
        const exact = name === normalizedQuery ? 0 : 1;
        const starts = name.startsWith(normalizedQuery) ? 0 : 1;
        const contains = searchableCompact.includes(normalizedQuery) || section.includes(normalizedQuery) || tokenMatch;
        return { student, exact, starts, contains };
      })
      .filter((item) => item.contains)
      .sort((a, b) => a.exact - b.exact || a.starts - b.starts || a.student.name.localeCompare(b.student.name, "ar"))
      .map((item) => item.student);
  }

  function getStudentStats(student) {
    const subjects = (student.subjects || []).filter((subject) => subject.includedInTotal !== false);
    const total = subjects.reduce((sum, subject) => sum + numberOrZero(subject.score), 0);
    const max = subjects.reduce((sum, subject) => sum + numberOrDefault(subject.max, 100), 0);
    const percentage = max > 0 ? (total / max) * 100 : 0;
    return {
      total,
      max,
      percentage,
      grade: getGrade(percentage)
    };
  }

  function isPromotedStudent(student) {
    const notes = normalizeArabic(student.notes);
    return (
      notes.includes("\u0627\u0646\u062a\u0642\u0644") &&
      !notes.includes("\u0644\u0645\u064a\u0646\u062a\u0642\u0644") &&
      !notes.includes("\u0644\u0645\u0627\u0646\u062a\u0642\u0644")
    );
  }

  function isAppreciationCertificateEligible(student) {
    return getStudentStats(student).percentage >= 60 && isPromotedStudent(student);
  }

  function getGrade(percentage) {
    if (percentage >= 90) return "ممتاز";
    if (percentage >= 80) return "جيد جدًا";
    if (percentage >= 70) return "جيد";
    if (percentage >= 60) return "مقبول";
    return "يحتاج متابعة";
  }

  function formatNumber(value) {
    return Number(value).toLocaleString("ar-SY", { maximumFractionDigits: 2 });
  }

  function formatPercent(value) {
    return value.toLocaleString("ar-SY", {
      maximumFractionDigits: 1,
      minimumFractionDigits: value % 1 === 0 ? 0 : 1
    }) + "%";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function applyBrand() {
    const institution = state.settings.institutionName || "المؤسسة";
    const reportTitle = state.settings.reportTitle || "نتائج الطلاب";
    document.querySelectorAll("[data-institution-name]").forEach((element) => {
      element.textContent = institution;
    });
    document.querySelectorAll("[data-report-title]").forEach((element) => {
      element.textContent = reportTitle;
    });
    document.querySelectorAll("[data-brand-mark]").forEach((element) => {
      element.textContent = institution.trim().charAt(0) || "ن";
    });
  }

  function initHomePage() {
    const form = document.getElementById("student-search-form");
    const input = document.getElementById("student-search");
    const resultsRegion = document.getElementById("results-region");
    const summary = document.getElementById("home-summary");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input.value;
      const results = findStudents(query);
      renderHomeResults(results, query, resultsRegion, summary);
    });

    input.addEventListener("input", () => {
      const query = input.value.trim();
      if (normalizeArabic(query).length >= 2) {
        const results = findStudents(query);
        renderHomeResults(results, query, resultsRegion, summary);
      }
      if (!query) {
        renderHomeEmpty(resultsRegion, summary);
      }
    });
  }

  function renderHomeEmpty(resultsRegion, summary) {
    summary.textContent = "";
    resultsRegion.innerHTML = `
      <div class="empty-state">
        <h2>ابدأ بالبحث عن اسم الطالب</h2>
        <p>يدعم البحث أجزاء الاسم، ويتجاهل أغلب الفروقات في المسافات والتشكيل.</p>
      </div>
    `;
  }

  function renderHomeResults(results, query, resultsRegion, summary) {
    if (!normalizeArabic(query)) {
      renderHomeEmpty(resultsRegion, summary);
      return;
    }

    if (!results.length) {
      summary.textContent = "";
      resultsRegion.innerHTML = `
        <div class="empty-state">
          <h2>لم يتم العثور على الطالب</h2>
          <p>جرّب كتابة جزء آخر من الاسم أو تأكد من المسافات.</p>
        </div>
      `;
      return;
    }

    summary.textContent = results.length === 1 ? "تم العثور على نتيجة واحدة." : `تم العثور على ${results.length} نتائج.`;
    resultsRegion.innerHTML = results.map(renderStudentCard).join("");
    resultsRegion.querySelectorAll("[data-print-student]").forEach((button) => {
      button.addEventListener("click", () => {
        const student = state.students.find((item) => item.id === button.dataset.printStudent);
        if (student) {
          printStudent(student);
        }
      });
    });
    resultsRegion.querySelectorAll("[data-print-student-landscape]").forEach((button) => {
      button.addEventListener("click", () => {
        const student = state.students.find((item) => item.id === button.dataset.printStudentLandscape);
        if (student) {
          printStudent(student, "landscape");
        }
      });
    });
    resultsRegion.querySelectorAll("[data-print-appreciation]").forEach((button) => {
      button.addEventListener("click", () => {
        const student = state.students.find((item) => item.id === button.dataset.printAppreciation);
        if (student) {
          printAppreciationCertificate(student);
        }
      });
    });
  }

  function renderStudentCard(student) {
    const stats = getStudentStats(student);
    const appreciationButton = isAppreciationCertificateEligible(student)
      ? `<button class="secondary-button certificate-button" type="button" data-print-appreciation="${escapeHtml(student.id)}">شهادة تقدير PDF</button>`
      : "";
    const subjectsRows = (student.subjects || []).map((subject) => `
      <tr>
        <td>${escapeHtml(subject.name)}</td>
        <td>${formatNumber(subject.score)}</td>
        <td>${formatNumber(subject.max)}</td>
        <td>${subject.includedInTotal === false ? "تفصيلي" : "معتمد"}</td>
      </tr>
    `).join("");

    return `
      <article class="student-card">
        <div class="student-card-header">
          <div>
            <h2>${escapeHtml(student.name)}</h2>
            <p class="meta-line">${escapeHtml(student.className || "غير محدد")} - ${escapeHtml(student.section || "لا توجد شعبة")}</p>
          </div>
          <span class="badge">${stats.grade}</span>
        </div>

        <div class="marks-table-wrap">
          <table class="marks-table">
            <thead>
              <tr>
                <th>المادة</th>
                <th>العلامة</th>
                <th>العلامة العظمى</th>
                <th>الحساب</th>
              </tr>
            </thead>
            <tbody>${subjectsRows || `<tr><td colspan="4">لا توجد مواد مسجلة.</td></tr>`}</tbody>
          </table>
        </div>

        <div class="summary-grid">
          <div class="summary-item">
            <span>المجموع</span>
            <strong>${formatNumber(stats.total)} / ${formatNumber(stats.max)}</strong>
          </div>
          <div class="summary-item">
            <span>النسبة المئوية</span>
            <strong>${formatPercent(stats.percentage)}</strong>
          </div>
          <div class="summary-item">
            <span>التقدير العام</span>
            <strong>${stats.grade}</strong>
          </div>
        </div>

        <div class="notes-box">
          <strong>ملاحظات:</strong>
          <span>${escapeHtml(student.notes || "لا توجد ملاحظات.")}</span>
        </div>

        <div class="card-actions">
          <button class="primary-button" type="button" data-print-student="${escapeHtml(student.id)}">طباعة النتيجة</button>
          <button class="secondary-button" type="button" data-print-student-landscape="${escapeHtml(student.id)}">طباعة أفقية</button>
          ${appreciationButton}
        </div>
      </article>
    `;
  }

  function initAdminPage() {
    const loginPanel = document.getElementById("admin-login-panel");
    const workspace = document.getElementById("admin-workspace");
    const loginForm = document.getElementById("admin-login-form");
    const passwordInput = document.getElementById("admin-password");
    const loginMessage = document.getElementById("login-message");

    if (sessionStorage.getItem(SESSION_KEY) === "true") {
      showAdminWorkspace(loginPanel, workspace);
    }

    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const expected = state.settings.adminPassword || "admin";
      if (passwordInput.value === expected) {
        sessionStorage.setItem(SESSION_KEY, "true");
        passwordInput.value = "";
        loginMessage.textContent = "";
        showAdminWorkspace(loginPanel, workspace);
      } else {
        loginMessage.textContent = "كلمة المرور غير صحيحة.";
      }
    });
  }

  function showAdminWorkspace(loginPanel, workspace) {
    loginPanel.hidden = true;
    workspace.hidden = false;
    initAdminWorkspace();
  }

  function initAdminWorkspace() {
    ensureSelectedStudentInActiveGroup();
    renderAdminGroupTabs();
    renderAdminStats();
    renderSettingsFields();
    renderAdminList();
    renderRankingPanel();
    renderSectionRankingPanel();
    loadStudentIntoEditor(getSelectedStudent() || createEmptyStudent());

    document.getElementById("admin-search").addEventListener("input", renderAdminList);
    document.getElementById("admin-grade-tabs").addEventListener("click", (event) => {
      const button = event.target.closest("[data-admin-group]");
      if (!button) return;
      activeAdminGroup = button.dataset.adminGroup;
      ensureSelectedStudentInActiveGroup();
      document.getElementById("admin-search").value = "";
      renderAdminGroupTabs();
      renderAdminStats();
      renderAdminList();
      renderRankingPanel();
      renderSectionRankingPanel();
      loadStudentIntoEditor(getSelectedStudent() || createEmptyStudent());
    });
    document.getElementById("ranking-section-filter").addEventListener("change", renderRankingTable);
    document.getElementById("section-subject-filter").addEventListener("change", renderSectionRankings);
    document.getElementById("print-ranking-button").addEventListener("click", printRankingReport);
    document.getElementById("print-section-students-button").addEventListener("click", () => printSectionStudentReports());
    document.getElementById("print-section-students-landscape-button").addEventListener("click", () => printSectionStudentReports("landscape"));
    document.getElementById("print-success-appreciation-button").addEventListener("click", printSuccessAppreciationCertificates);
    document.getElementById("new-student-button").addEventListener("click", () => {
      selectedStudentId = null;
      loadStudentIntoEditor(createEmptyStudent());
      showEditorMessage("جاهز لإضافة طالب جديد.");
    });
    document.getElementById("logout-button").addEventListener("click", () => {
      sessionStorage.removeItem(SESSION_KEY);
      location.reload();
    });
    document.getElementById("export-data-button").addEventListener("click", () => {
      saveSettingsFromEditor();
      downloadJson("students-data.json", state);
    });
    document.getElementById("reset-data-button").addEventListener("click", () => {
      if (confirm("سيتم حذف بيانات الطلاب المحفوظة من هذا المتصفح. هل تريد المتابعة؟")) {
        resetState();
        ensureSelectedStudentInActiveGroup();
        renderAdminGroupTabs();
        renderAdminStats();
        renderSettingsFields();
        renderAdminList();
        renderRankingPanel();
        renderSectionRankingPanel();
        loadStudentIntoEditor(getSelectedStudent() || createEmptyStudent());
        showEditorMessage("تم تفريغ بيانات الطلاب.");
      }
    });
    document.getElementById("add-subject-button").addEventListener("click", () => {
      addSubjectRow({ name: "", score: 0, max: 100 });
    });
    document.getElementById("student-editor-form").addEventListener("submit", (event) => {
      event.preventDefault();
      saveStudentFromEditor();
    });
    document.getElementById("delete-student-button").addEventListener("click", deleteSelectedStudent);
    document.getElementById("print-selected-button").addEventListener("click", () => {
      saveSettingsFromEditor();
      const student = collectStudentFromEditor();
      if (!student.name.trim()) {
        showEditorMessage("أدخل اسم الطالب قبل الطباعة.", true);
        return;
      }
      printStudent(student);
    });
    document.getElementById("print-selected-landscape-button").addEventListener("click", () => {
      saveSettingsFromEditor();
      const student = collectStudentFromEditor();
      if (!student.name.trim()) {
        showEditorMessage("أدخل اسم الطالب قبل الطباعة.", true);
        return;
      }
      printStudent(student, "landscape");
    });
    document.getElementById("print-appreciation-button").addEventListener("click", () => {
      saveSettingsFromEditor();
      const student = collectStudentFromEditor();
      if (!student.name.trim()) {
        showEditorMessage("أدخل اسم الطالب قبل الطباعة.", true);
        return;
      }
      if (!isAppreciationCertificateEligible(student)) {
        showEditorMessage("شهادة التقدير متاحة فقط للطلاب الناجحين الذين انتقلوا إلى المستوى التالي.", true);
        return;
      }
      printAppreciationCertificate(student);
    });
    document.getElementById("export-selected-button").addEventListener("click", () => {
      const student = collectStudentFromEditor();
      if (!student.name.trim()) {
        showEditorMessage("أدخل اسم الطالب قبل التصدير.", true);
        return;
      }
      downloadJson(`${student.name.replace(/\s+/g, "-")}.json`, student);
    });

    ["institution-name-input", "report-title-input", "logo-url-input", "signature-name-input", "admin-password-input"].forEach((id) => {
      document.getElementById(id).addEventListener("change", saveSettingsFromEditor);
    });
  }

  function renderAdminGroupTabs() {
    const tabs = document.getElementById("admin-grade-tabs");
    if (!tabs) return;

    tabs.querySelectorAll("[data-admin-group]").forEach((button) => {
      const group = button.dataset.adminGroup;
      const count = state.students.filter((student) => getAdminGroup(student) === group).length;
      button.classList.toggle("active", group === activeAdminGroup);
      button.setAttribute("aria-selected", group === activeAdminGroup ? "true" : "false");
      const countElement = button.querySelector("[data-group-count]");
      if (countElement) {
        countElement.textContent = count.toLocaleString("ar-SY");
      }
    });
  }

  function createEmptyStudent() {
    const isSixth = activeAdminGroup === SIXTH_GROUP;
    const isFifth = activeAdminGroup === FIFTH_GROUP;
    const className = isFifth
      ? "الصف الخامس - الفئة الثانية - المستوى الثاني"
      : isSixth
        ? "الصف السادس - الفئة الثانية - المستوى الثاني"
        : "الفئة الثالثة - المستوى الثالث";
    const subjects = isFifth
      ? [
        { name: "سيرة نبوية", score: 0, max: 15, includedInTotal: false },
        { name: "فقه الطهارة والصلاة", score: 0, max: 15, includedInTotal: false },
        { name: "محصلة المذاكرات", score: 0, max: 30, includedInTotal: false },
        { name: "الفحص النهائي", score: 0, max: 20, includedInTotal: false },
        { name: "المحصلة النهائية", score: 0, max: 50, includedInTotal: true }
      ]
      : isSixth
        ? [
          { name: "السيرة والشمائل", score: 0, max: 20 },
          { name: "الاربعون النووية 1", score: 0, max: 20 },
          { name: "الفحص النهائي", score: 0, max: 30 }
        ]
        : [
          { name: "الحفظ", score: 0, max: 100 },
          { name: "التجويد", score: 0, max: 100 }
        ];

    return {
      id: createId(),
      name: "",
      className,
      section: "",
      gradeGroup: activeAdminGroup,
      notes: "",
      subjects
    };
  }

  function getSelectedStudent() {
    return getActiveAdminStudents().find((student) => student.id === selectedStudentId) || getActiveAdminStudents()[0] || null;
  }

  function renderAdminStats() {
    const activeStudents = getActiveAdminStudents();
    const totalStudents = activeStudents.length;
    const average = totalStudents
      ? activeStudents.reduce((sum, student) => sum + getStudentStats(student).percentage, 0) / totalStudents
      : 0;
    document.getElementById("stat-students").textContent = totalStudents.toLocaleString("ar-SY");
    document.getElementById("stat-average").textContent = formatPercent(average);
    document.getElementById("stat-save").textContent = localStorage.getItem(STORAGE_KEY) ? "محفوظ" : "افتراضي";
  }

  function renderSettingsFields() {
    document.getElementById("institution-name-input").value = state.settings.institutionName || "";
    document.getElementById("report-title-input").value = state.settings.reportTitle || "";
    document.getElementById("logo-url-input").value = state.settings.logoUrl || "";
    document.getElementById("signature-name-input").value = state.settings.signatureName || "";
    document.getElementById("admin-password-input").value = state.settings.adminPassword || "";
  }

  function saveSettingsFromEditor() {
    state.settings.institutionName = document.getElementById("institution-name-input").value.trim() || "المؤسسة";
    state.settings.reportTitle = document.getElementById("report-title-input").value.trim() || "نتائج الطلاب";
    state.settings.logoUrl = document.getElementById("logo-url-input").value.trim();
    state.settings.signatureName = document.getElementById("signature-name-input").value.trim() || "إدارة المؤسسة";
    state.settings.adminPassword = document.getElementById("admin-password-input").value || "admin";
    saveState();
    renderAdminStats();
    showEditorMessage("تم حفظ إعدادات التقرير.");
  }

  function renderRankingPanel() {
    const filter = document.getElementById("ranking-section-filter");
    if (!filter) return;

    const currentValue = filter.value;
    const sections = [...new Set(getActiveAdminStudents().map((student) => student.section).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "ar"));

    filter.innerHTML = `<option value="">كل حلقات هذا القسم</option>` + sections.map((section) => (
      `<option value="${escapeHtml(section)}">${escapeHtml(section)}</option>`
    )).join("");

    if (currentValue && sections.includes(currentValue)) {
      filter.value = currentValue;
    }

    renderRankingTable();
  }

  function renderRankingTable() {
    const filter = document.getElementById("ranking-section-filter");
    const body = document.getElementById("ranking-table-body");
    if (!filter || !body) return;

    const selectedSection = filter.value;
    const ranked = getRankedStudents(selectedSection);

    if (!ranked.length) {
      body.innerHTML = `<tr><td colspan="6">لا توجد بيانات لعرض الترتيب.</td></tr>`;
      return;
    }

    body.innerHTML = ranked.map(({ student, stats, rank }) => `
      <tr>
        <td><span class="ranking-place">${rank.toLocaleString("ar-SY")}</span></td>
        <td><button class="ranking-student-button" type="button" data-ranking-student="${escapeHtml(student.id)}">${escapeHtml(student.name)}</button></td>
        <td>${escapeHtml(student.section || "غير محدد")}</td>
        <td>${formatNumber(stats.total)} / ${formatNumber(stats.max)}</td>
        <td>${formatPercent(stats.percentage)}</td>
        <td>${stats.grade}</td>
      </tr>
    `).join("");

    body.querySelectorAll("[data-ranking-student]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedStudentId = button.dataset.rankingStudent;
        const student = getSelectedStudent();
        if (student) {
          loadStudentIntoEditor(student);
          renderAdminList();
          document.getElementById("student-editor-form").scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function renderSectionRankingPanel() {
    const subjectFilter = document.getElementById("section-subject-filter");
    if (!subjectFilter) return;

    const currentValue = subjectFilter.value;
    const subjects = getActiveSubjectNames();
    subjectFilter.innerHTML = subjects.length
      ? subjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join("")
      : `<option value="">لا توجد مواد</option>`;

    if (subjects.includes(currentValue)) {
      subjectFilter.value = currentValue;
    } else if (subjects.length) {
      subjectFilter.value = subjects[0];
    }

    renderSectionRankings();
  }

  function renderSectionRankings() {
    renderFinalSectionRanking();
    renderSubjectSectionRanking();
  }

  function renderFinalSectionRanking() {
    const body = document.getElementById("section-final-ranking-body");
    const summary = document.getElementById("section-final-ranking-summary");
    if (!body || !summary) return;

    const ranked = getSectionFinalRankings();
    summary.textContent = ranked.length
      ? `${ranked.length.toLocaleString("ar-SY")} حلقة`
      : "لا توجد حلقات";

    if (!ranked.length) {
      body.innerHTML = `<tr><td colspan="5">لا توجد حلقات لعرض ترتيبها.</td></tr>`;
      return;
    }

    body.innerHTML = ranked.map((item) => `
      <tr>
        <td><span class="ranking-place">${item.rank.toLocaleString("ar-SY")}</span></td>
        <td>${escapeHtml(item.section)}</td>
        <td>${item.count.toLocaleString("ar-SY")}</td>
        <td>${formatPercent(item.average)}</td>
        <td>${getGrade(item.average)}</td>
      </tr>
    `).join("");
  }

  function renderSubjectSectionRanking() {
    const subjectFilter = document.getElementById("section-subject-filter");
    const body = document.getElementById("section-subject-ranking-body");
    const summary = document.getElementById("section-subject-ranking-summary");
    if (!subjectFilter || !body || !summary) return;

    const subjectName = subjectFilter.value;
    const ranked = subjectName ? getSectionSubjectRankings(subjectName) : [];
    summary.textContent = subjectName || "اختر مادة";

    if (!subjectName) {
      body.innerHTML = `<tr><td colspan="5">لا توجد مواد لعرض ترتيب الحلقات.</td></tr>`;
      return;
    }
    if (!ranked.length) {
      body.innerHTML = `<tr><td colspan="5">لا توجد بيانات لهذه المادة.</td></tr>`;
      return;
    }

    body.innerHTML = ranked.map((item) => `
      <tr>
        <td><span class="ranking-place">${item.rank.toLocaleString("ar-SY")}</span></td>
        <td>${escapeHtml(item.section)}</td>
        <td>${item.count.toLocaleString("ar-SY")}</td>
        <td>${formatNumber(item.averageScore)} / ${formatNumber(item.averageMax)}</td>
        <td>${formatPercent(item.percentage)}</td>
      </tr>
    `).join("");
  }

  function getActiveSubjectNames() {
    return [...new Set(
      getActiveAdminStudents()
        .flatMap((student) => student.subjects || [])
        .map((subject) => subject.name)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ar"));
  }

  function getSectionFinalRankings() {
    const grouped = groupStudentsBySection(getActiveAdminStudents());
    const rows = [...grouped.values()]
      .map((group) => {
        const average = group.students.reduce((sum, student) => sum + getStudentStats(student).percentage, 0) / group.students.length;
        return {
          section: group.section,
          count: group.students.length,
          average
        };
      })
      .sort((a, b) => b.average - a.average || b.count - a.count || a.section.localeCompare(b.section, "ar"));

    return assignSectionRanks(rows, (item) => item.average);
  }

  function getSectionSubjectRankings(subjectName) {
    const grouped = groupStudentsBySection(getActiveAdminStudents());
    const rows = [...grouped.values()]
      .map((group) => {
        const subjects = group.students
          .map((student) => getStudentSubject(student, subjectName))
          .filter(Boolean);
        if (!subjects.length) return null;

        const totalScore = subjects.reduce((sum, subject) => sum + numberOrZero(subject.score), 0);
        const totalMax = subjects.reduce((sum, subject) => sum + numberOrDefault(subject.max, 100), 0);
        return {
          section: group.section,
          count: subjects.length,
          averageScore: totalScore / subjects.length,
          averageMax: totalMax / subjects.length,
          percentage: totalMax > 0 ? (totalScore / totalMax) * 100 : 0
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.percentage - a.percentage || b.averageScore - a.averageScore || b.count - a.count || a.section.localeCompare(b.section, "ar"));

    return assignSectionRanks(rows, (item) => item.percentage);
  }

  function groupStudentsBySection(students) {
    return students.reduce((groups, student) => {
      const section = student.section || "غير محدد";
      if (!groups.has(section)) {
        groups.set(section, { section, students: [] });
      }
      groups.get(section).students.push(student);
      return groups;
    }, new Map());
  }

  function getStudentSubject(student, subjectName) {
    const target = normalizeArabic(normalizeSubjectName(subjectName));
    return (student.subjects || []).find((subject) => normalizeArabic(normalizeSubjectName(subject.name)) === target) || null;
  }

  function assignSectionRanks(rows, getValue) {
    let currentRank = 0;
    let previousValue = null;

    return rows.map((item) => {
      const value = getValue(item);
      if (previousValue === null || Math.abs(value - previousValue) > 0.000001) {
        currentRank += 1;
      }
      previousValue = value;
      return { ...item, rank: currentRank };
    });
  }

  function getRankedStudents(section = "", students = getActiveAdminStudents()) {
    const sorted = students
      .filter((student) => !section || student.section === section)
      .map((student) => ({ student, stats: getStudentStats(student) }))
      .sort(compareRankedStudents);
    return assignDenseRanks(sorted);
  }

  function compareRankedStudents(a, b) {
    return (
      b.stats.percentage - a.stats.percentage ||
      b.stats.total - a.stats.total ||
      a.student.name.localeCompare(b.student.name, "ar")
    );
  }

  function assignDenseRanks(ranked) {
    let currentRank = 0;
    let previous = null;

    return ranked.map((item) => {
      if (!previous || !hasSameRankScore(item, previous)) {
        currentRank += 1;
      }
      previous = item;
      return { ...item, rank: currentRank };
    });
  }

  function hasSameRankScore(a, b) {
    return (
      Math.abs(a.stats.percentage - b.stats.percentage) < 0.000001 &&
      Math.abs(a.stats.total - b.stats.total) < 0.000001
    );
  }

  function getStudentTopRank(student) {
    const studentGroup = getAdminGroup(student);
    const groupStudents = state.students.filter((item) => getAdminGroup(item) === studentGroup);
    const rankingStudents = groupStudents.some((item) => item.id === student.id)
      ? groupStudents.map((item) => item.id === student.id ? student : item)
      : [...groupStudents, student];
    const rankedStudent = getRankedStudents("", rankingStudents)
      .find((item) => item.student.id === student.id);

    return rankedStudent && rankedStudent.rank <= 10 ? rankedStudent.rank : null;
  }

  function printRankingReport() {
    const filter = document.getElementById("ranking-section-filter");
    const section = filter ? filter.value : "";
    const ranked = getRankedStudents(section);
    if (!ranked.length) {
      alert("لا توجد بيانات لطباعة الترتيب.");
      return;
    }

    startPrint(buildRankingPrintReport(ranked, section || activeAdminGroup));
  }

  function printSectionStudentReports(layout = "portrait") {
    const filter = document.getElementById("ranking-section-filter");
    const section = filter ? filter.value : "";
    if (!section) {
      alert("اختر حلقة محددة أولًا لطباعة شهادات طلابها.");
      return;
    }

    const ranked = getRankedStudents(section);
    if (!ranked.length) {
      alert("لا توجد بيانات لطباعة شهادات هذه الحلقة.");
      return;
    }

    startPrint(ranked.map(({ student }) => buildPrintReport(student, layout)).join(""), layout);
  }

  function printSuccessAppreciationCertificates() {
    const filter = document.getElementById("ranking-section-filter");
    const section = filter ? filter.value : "";
    const ranked = getRankedStudents(section);
    const eligibleStudents = ranked
      .map(({ student }) => student)
      .filter(isAppreciationCertificateEligible);

    if (!eligibleStudents.length) {
      alert(section
        ? "لا يوجد طلاب ناجحون انتقلوا إلى المستوى التالي في هذه الحلقة."
        : "لا يوجد طلاب ناجحون انتقلوا إلى المستوى التالي في هذا القسم.");
      return;
    }

    startPrint(eligibleStudents.map(buildAppreciationPrintReport).join(""), "landscape");
  }

  function renderAdminList() {
    const query = document.getElementById("admin-search").value;
    const list = document.getElementById("admin-student-list");
    const activeStudents = getActiveAdminStudents();
    const students = normalizeArabic(query) ? findStudents(query, activeStudents) : [...activeStudents].sort((a, b) => a.name.localeCompare(b.name, "ar"));

    if (!students.length) {
      list.innerHTML = `<div class="empty-state"><p>لا توجد نتائج مطابقة.</p></div>`;
      return;
    }

    list.innerHTML = students.map((student) => `
      <button class="student-list-button ${student.id === selectedStudentId ? "active" : ""}" type="button" data-admin-student="${escapeHtml(student.id)}">
        <strong>${escapeHtml(student.name || "طالب بدون اسم")}</strong>
        <small>${escapeHtml(student.className || "غير محدد")} - ${escapeHtml(student.section || "لا توجد شعبة")}</small>
      </button>
    `).join("");

    list.querySelectorAll("[data-admin-student]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedStudentId = button.dataset.adminStudent;
        loadStudentIntoEditor(getSelectedStudent());
        renderAdminList();
      });
    });
  }

  function loadStudentIntoEditor(student) {
    document.getElementById("student-id").value = student.id;
    document.getElementById("student-name").value = student.name || "";
    document.getElementById("student-class").value = student.className || "";
    document.getElementById("student-section").value = student.section || "";
    document.getElementById("student-notes").value = student.notes || "";

    const body = document.getElementById("subjects-editor-body");
    body.innerHTML = "";
    (student.subjects || []).forEach(addSubjectRow);
    if (!student.subjects || !student.subjects.length) {
      addSubjectRow({ name: "", score: 0, max: 100 });
    }
  }

  function addSubjectRow(subject) {
    const body = document.getElementById("subjects-editor-body");
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input class="subject-name" type="text" value="${escapeHtml(subject.name)}" placeholder="اسم المادة"></td>
      <td><input class="subject-score small-number" type="number" min="0" step="0.5" value="${escapeHtml(subject.score)}"></td>
      <td><input class="subject-max small-number" type="number" min="1" step="0.5" value="${escapeHtml(subject.max)}"></td>
      <td class="checkbox-cell"><input class="subject-included" type="checkbox" ${subject.includedInTotal === false ? "" : "checked"} aria-label="يحسب في المجموع"></td>
      <td><button class="remove-row-button" type="button" aria-label="حذف المادة">×</button></td>
    `;
    row.querySelector(".remove-row-button").addEventListener("click", () => {
      row.remove();
    });
    body.appendChild(row);
  }

  function collectStudentFromEditor() {
    const rows = Array.from(document.querySelectorAll("#subjects-editor-body tr"));
    const id = document.getElementById("student-id").value || createId();
    const existingStudent = state.students.find((student) => student.id === id);
    return normalizeStudent({
      id,
      name: document.getElementById("student-name").value.trim(),
      className: document.getElementById("student-class").value.trim(),
      section: document.getElementById("student-section").value.trim(),
      gradeGroup: existingStudent ? getAdminGroup(existingStudent) : activeAdminGroup,
      notes: document.getElementById("student-notes").value.trim(),
      subjects: rows.map((row) => ({
        name: row.querySelector(".subject-name").value.trim(),
        score: row.querySelector(".subject-score").value,
        max: row.querySelector(".subject-max").value,
        includedInTotal: row.querySelector(".subject-included").checked
      })).filter((subject) => subject.name)
    });
  }

  function saveStudentFromEditor() {
    saveSettingsFromEditor();
    const student = collectStudentFromEditor();

    if (!student.name.trim()) {
      showEditorMessage("اسم الطالب مطلوب.", true);
      return;
    }
    if (!student.subjects.length) {
      showEditorMessage("أضف مادة واحدة على الأقل.", true);
      return;
    }

    const existingIndex = state.students.findIndex((item) => item.id === student.id);
    if (existingIndex >= 0) {
      state.students[existingIndex] = student;
    } else {
      state.students.push(student);
    }

    selectedStudentId = student.id;
    saveState();
    renderAdminGroupTabs();
    renderAdminStats();
    renderAdminList();
    renderRankingPanel();
    renderSectionRankingPanel();
    loadStudentIntoEditor(student);
    showEditorMessage("تم حفظ بيانات الطالب.");
  }

  function deleteSelectedStudent() {
    const id = document.getElementById("student-id").value;
    const student = state.students.find((item) => item.id === id);
    if (!student) {
      showEditorMessage("لا يوجد طالب محفوظ لحذفه.", true);
      return;
    }

    if (confirm(`هل تريد حذف الطالب: ${student.name}؟`)) {
      state.students = state.students.filter((item) => item.id !== id);
      ensureSelectedStudentInActiveGroup();
      saveState();
      renderAdminGroupTabs();
      renderAdminStats();
      renderAdminList();
      renderRankingPanel();
      renderSectionRankingPanel();
      loadStudentIntoEditor(getSelectedStudent() || createEmptyStudent());
      showEditorMessage("تم حذف الطالب.");
    }
  }

  function showEditorMessage(message, isError = false) {
    const element = document.getElementById("editor-message");
    element.textContent = message;
    element.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function startPrint(markup, layout = "portrait") {
    const printRoot = document.getElementById("print-root");
    if (!printRoot) return;

    printRoot.innerHTML = markup;
    document.body.classList.toggle("printing-landscape", layout === "landscape");
    document.body.classList.add("printing");
    setTimeout(() => window.print(), 80);
  }

  function printStudent(student, layout = "portrait") {
    startPrint(buildPrintReport(student, layout), layout);
  }

  function printAppreciationCertificate(student) {
    if (!isAppreciationCertificateEligible(student)) {
      alert("شهادة التقدير متاحة فقط للطلاب الناجحين الذين انتقلوا إلى المستوى التالي.");
      return;
    }
    startPrint(buildAppreciationPrintReport(student), "landscape");
  }

  function getPrintLogoMarkup(settings) {
    const logoUrl = "assets/qobaa-logo-vertical.png";
    return `<img class="print-logo" src="${escapeHtml(logoUrl)}" alt="شعار مسجد قباء">`;
  }

  function getPrintHeaderMarkup(settings) {
    return `
      <header class="print-header">
        <div class="print-brand-copy">
          <h1>مسجد قباء</h1>
          <p>الامتحانات الدورية</p>
        </div>
        ${getPrintLogoMarkup(settings)}
        <div class="print-header-spacer" aria-hidden="true"></div>
      </header>
    `;
  }

  function getDirectorSignatureMarkup() {
    return `
      <div class="print-signature">
        <strong>توقيع مدير المعهد</strong>
        <span aria-hidden="true"></span>
      </div>
    `;
  }

  function buildPrintReport(student, layout = "portrait") {
    return layout === "landscape" ? buildLandscapePrintReport(student) : buildPortraitPrintReport(student);
  }

  function buildPortraitPrintReport(student) {
    const stats = getStudentStats(student);
    const rank = getStudentTopRank(student);
    const rankMarkup = rank
      ? ` <span class="print-rank"><strong>المرتبة:</strong> ${rank.toLocaleString("ar-SY")}</span>`
      : "";
    const settings = state.settings;
    const rows = (student.subjects || []).map((subject) => `
      <tr>
        <td>${escapeHtml(subject.name)}</td>
        <td>${formatNumber(subject.score)}</td>
        <td>${formatNumber(subject.max)}</td>
        <td>${subject.includedInTotal === false ? "تفصيلي" : "معتمد"}</td>
      </tr>
    `).join("");

    return `
      <article class="print-report">
        <section class="print-sheet">
          ${getPrintHeaderMarkup(settings)}

          <div class="print-meta">
            <div><strong>اسم الطالب:</strong> ${escapeHtml(student.name)}</div>
            <div><strong>الفئة:</strong> ${escapeHtml(student.className || "غير محدد")}</div>
            <div><strong>الحلقة:</strong> ${escapeHtml(student.section || "غير محدد")}</div>
            <div><strong>التقدير العام:</strong> ${stats.grade}${rankMarkup}</div>
          </div>

          <table class="print-table">
            <thead>
              <tr>
                <th>المادة</th>
                <th>العلامة</th>
                <th>العلامة العظمى</th>
                <th>الحساب</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="4">لا توجد مواد مسجلة.</td></tr>`}</tbody>
          </table>

          <div class="print-summary">
            <div><strong>المجموع</strong><br>${formatNumber(stats.total)} / ${formatNumber(stats.max)}</div>
            <div><strong>النسبة المئوية</strong><br>${formatPercent(stats.percentage)}</div>
            <div><strong>التقدير</strong><br>${stats.grade}</div>
          </div>

          <div class="print-notes">
            <div class="print-notes-content">
              <strong>ملاحظات:</strong>
              <p>${escapeHtml(student.notes || "لا توجد ملاحظات.")}</p>
            </div>
            ${getDirectorSignatureMarkup()}
          </div>

        </section>
      </article>
    `;
  }

  function buildLandscapePrintReport(student) {
    const stats = getStudentStats(student);
    const rank = getStudentTopRank(student);
    const rankMarkup = rank
      ? ` <span class="print-rank"><strong>المرتبة:</strong> ${rank.toLocaleString("ar-SY")}</span>`
      : "";
    const settings = state.settings;
    const rows = (student.subjects || []).map((subject) => `
      <tr>
        <td>${escapeHtml(subject.name)}</td>
        <td>${formatNumber(subject.score)}</td>
        <td>${formatNumber(subject.max)}</td>
        <td>${subject.includedInTotal === false ? "تفصيلي" : "معتمد"}</td>
      </tr>
    `).join("");

    return `
      ${buildLandscapeCoverPage(student)}
      <article class="print-report landscape-print-report">
        <section class="print-sheet landscape-print-sheet">
          ${getPrintHeaderMarkup(settings)}

          <div class="landscape-print-body">
            <div class="landscape-main-panel">
              <div class="print-meta">
                <div><strong>اسم الطالب:</strong> ${escapeHtml(student.name)}</div>
                <div><strong>الفئة:</strong> ${escapeHtml(student.className || "غير محدد")}</div>
                <div><strong>الحلقة:</strong> ${escapeHtml(student.section || "غير محدد")}</div>
                <div><strong>التقدير العام:</strong> ${stats.grade}${rankMarkup}</div>
              </div>

              <table class="print-table">
                <thead>
                  <tr>
                    <th>المادة</th>
                    <th>العلامة</th>
                    <th>العلامة العظمى</th>
                    <th>الحساب</th>
                  </tr>
                </thead>
                <tbody>${rows || `<tr><td colspan="4">لا توجد مواد مسجلة.</td></tr>`}</tbody>
              </table>
            </div>

            <aside class="landscape-side-panel">
              <div class="print-summary">
                <div><strong>المجموع</strong><br>${formatNumber(stats.total)} / ${formatNumber(stats.max)}</div>
                <div><strong>النسبة المئوية</strong><br>${formatPercent(stats.percentage)}</div>
                <div><strong>التقدير</strong><br>${stats.grade}</div>
              </div>

              <div class="print-notes">
                <div class="print-notes-content">
                  <strong>ملاحظات:</strong>
                  <p>${escapeHtml(student.notes || "لا توجد ملاحظات.")}</p>
                </div>
                ${getDirectorSignatureMarkup()}
              </div>
            </aside>
          </div>

        </section>
      </article>
    `;
  }

  function buildLandscapeCoverPage(student) {
    const sectionText = student.section || student.className || "غير محدد";

    return `
      <article class="print-report landscape-cover-report">
        <section class="print-sheet landscape-cover-sheet">
          <img class="landscape-cover-image" src="assets/grade-landscape-cover.png" alt="غلاف سجل علامات الطالب">
          <div class="landscape-cover-field landscape-cover-name">${escapeHtml(student.name)}</div>
          <div class="landscape-cover-field landscape-cover-section">${escapeHtml(sectionText)}</div>
        </section>
      </article>
    `;
  }

  function buildAppreciationPrintReport(student) {
    const stats = getStudentStats(student);
    const settings = state.settings;
    const promotionText = student.notes || "انتقل إلى المستوى التالي";

    return `
      <article class="print-report appreciation-print-report">
        <section class="print-sheet landscape-print-sheet appreciation-print-sheet">
          ${getPrintHeaderMarkup(settings)}

          <div class="appreciation-certificate">
            <section class="appreciation-frame">
              <div class="appreciation-heading">
                <p class="appreciation-kicker">بكل تقدير واعتزاز</p>
                <h2>شهادة تقدير</h2>
              </div>
              <p class="appreciation-intro">تمنح إدارة مسجد قباء هذه الشهادة للطالب</p>
              <strong class="appreciation-student-name">${escapeHtml(student.name)}</strong>
              <p class="appreciation-body">
                تقديرًا لاجتهاده ونجاحه في الامتحانات الدورية وانتقاله إلى المستوى التالي.
              </p>

              <div class="appreciation-stats">
                <div>
                  <strong>النسبة المئوية</strong>
                  <span>${formatPercent(stats.percentage)}</span>
                </div>
                <div>
                  <strong>التقدير</strong>
                  <span>${stats.grade}</span>
                </div>
              </div>

              <div class="appreciation-details">
                <div><strong>الفئة:</strong> ${escapeHtml(student.className || "غير محدد")}</div>
                <div><strong>الحلقة:</strong> ${escapeHtml(student.section || "غير محدد")}</div>
              </div>

              <p class="appreciation-status">${escapeHtml(promotionText)}</p>

              <div class="print-signature-row">
                ${getDirectorSignatureMarkup()}
              </div>
            </section>
          </div>

        </section>
      </article>
    `;
  }

  function buildRankingPrintReport(ranked, section) {
    const title = section || "كل الحلقات";
    const settings = state.settings;
    const rows = ranked.map(({ student, stats, rank }) => `
      <tr>
        <td>${rank.toLocaleString("ar-SY")}</td>
        <td>${escapeHtml(student.name)}</td>
        <td>${escapeHtml(student.section || "غير محدد")}</td>
        <td>${formatNumber(stats.total)} / ${formatNumber(stats.max)}</td>
        <td>${formatPercent(stats.percentage)}</td>
        <td>${stats.grade}</td>
      </tr>
    `).join("");

    return `
      <article class="print-report">
        <section class="print-sheet ranking-print-sheet">
          ${getPrintHeaderMarkup(settings)}

          <div class="ranking-print-summary">
            <div><strong>الحلقة:</strong> ${escapeHtml(title)}</div>
            <div><strong>عدد الطلاب:</strong> ${ranked.length.toLocaleString("ar-SY")}</div>
            <div><strong>طريقة الترتيب:</strong> من الأعلى علامة إلى الأقل</div>
          </div>

          <table class="print-table ranking-print-table">
            <thead>
              <tr>
                <th>الترتيب</th>
                <th>اسم الطالب</th>
                <th>الحلقة</th>
                <th>المجموع</th>
                <th>النسبة</th>
                <th>التقدير</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div class="print-signature-row">
            ${getDirectorSignatureMarkup()}
          </div>

        </section>
      </article>
    `;
  }
})();
