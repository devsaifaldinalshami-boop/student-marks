(() => {
  const SESSION_KEY = "qobaa-admin-authenticated";
  const RING_NAME_EDITS_KEY = "qobaa-mosque-ring-name-edits-v1";
  const RING_STUDENTS_KEY = "qobaa-mosque-ring-students-v1";
  const dataset = window.MOSQUE_RINGS_DATA || { rings: [] };
  const state = {
    query: "",
    category: "",
    selectedRingId: "",
  };

  document.addEventListener("DOMContentLoaded", init);

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing");
    document.body.classList.remove("printing-landscape");
    const printRoot = document.getElementById("print-root");
    if (printRoot) {
      printRoot.innerHTML = "";
    }
  });

  function init() {
    if (sessionStorage.getItem(SESSION_KEY) !== "true") {
      renderLoginGate();
      return;
    }

    renderSummary();
    populateFilters();
    bindControls();
    renderFromHash();
  }

  function renderLoginGate() {
    const main = document.getElementById("rings-main");
    if (!main) return;

    main.innerHTML = `
      <section class="login-panel rings-gate">
        <div class="title-block">
          <p class="eyebrow">منطقة الإدارة</p>
          <h1>حلقات المسجد</h1>
          <p class="lead">يرجى تسجيل الدخول من لوحة الإدارة لعرض بيانات الحلقات.</p>
        </div>
        <a class="primary-button" href="admin.html">دخول الإدارة</a>
      </section>
    `;
  }

  function bindControls() {
    const search = document.getElementById("rings-search");
    const category = document.getElementById("rings-category-filter");
    const reset = document.getElementById("rings-reset-button");
    const categoryPdf = document.getElementById("rings-category-pdf-button");

    search?.addEventListener("input", () => {
      state.query = search.value.trim();
      renderRings();
    });

    category?.addEventListener("change", () => {
      state.category = category.value;
      renderRings();
    });

    reset?.addEventListener("click", () => {
      state.query = "";
      state.category = "";
      if (search) search.value = "";
      if (category) category.value = "";
      renderRings();
    });

    categoryPdf?.addEventListener("click", printSelectedCategoryStudents);

    document.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-open-ring]");
      if (openButton) {
        openRing(openButton.dataset.openRing);
        return;
      }

      const backButton = event.target.closest("[data-back-to-rings]");
      if (backButton) {
        event.preventDefault();
        closeRingDetail();
        return;
      }

      const printButton = event.target.closest("[data-print-ring-students]");
      if (printButton) {
        printRingStudents(printButton.dataset.printRingStudents);
        return;
      }

      const saveButton = event.target.closest("[data-save-ring-name]");
      if (saveButton) {
        saveRingName(saveButton.dataset.saveRingName, saveButton.closest(".ring-name-editor"));
        return;
      }

      const deleteButton = event.target.closest("[data-delete-ring-student]");
      if (deleteButton) {
        deleteRingStudent(deleteButton.dataset.ringId, deleteButton.dataset.deleteRingStudent);
      }
    });

    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-ring-student-form]");
      if (!form) return;
      event.preventDefault();
      addRingStudent(form.dataset.ringStudentForm, form);
    });

    document.addEventListener("keydown", (event) => {
      const input = event.target.closest("[data-ring-name-input]");
      if (!input || event.key !== "Enter") return;
      event.preventDefault();
      saveRingName(input.dataset.ringNameInput, input.closest(".ring-name-editor"));
    });

    window.addEventListener("hashchange", renderFromHash);
  }

  function renderFromHash() {
    const ringId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    const ring = ringId ? getRingById(ringId) : null;

    if (ring) {
      state.selectedRingId = ring.id;
      renderRingDetail(ring);
      return;
    }

    state.selectedRingId = "";
    setListVisible(true);
    renderSummary();
    renderRings();
  }

  function renderSummary() {
    const rings = getRings();
    const teacherCount = rings.filter((ring) => ring.teacher).length;
    const missingNameCount = rings.filter((ring) => !ring.name).length;
    const studentCount = rings.reduce((total, ring) => total + ring.studentCount, 0);

    setText("rings-count", String(rings.length));
    setText("rings-student-count", String(studentCount));
    setText("rings-teacher-count", String(teacherCount));
    setText("rings-pending-count", String(missingNameCount));
  }

  function populateFilters() {
    fillSelect("rings-category-filter", uniqueValues(getRings(), "category"), "كل الفئات");
  }

  function renderRings() {
    const rings = getFilteredRings();
    const cards = document.getElementById("rings-cards");
    const body = document.getElementById("rings-table-body");
    const summary = document.getElementById("rings-result-summary");

    if (summary) {
      summary.textContent = rings.length
        ? `يتم عرض ${rings.length} من أصل ${getRings().length} حلقة`
        : "لا توجد حلقات مطابقة";
    }

    if (body) {
      body.innerHTML = rings.length
        ? rings.map(renderSafeRingRow).join("")
        : `<tr><td class="rings-empty-cell" colspan="7">لا توجد حلقات مطابقة لخيارات البحث الحالية.</td></tr>`;
    }

    if (cards) {
      cards.innerHTML = rings.length
        ? rings.map(renderSafeRingCard).join("")
        : `<div class="rings-empty">لا توجد حلقات مطابقة لخيارات البحث الحالية.</div>`;
    }
  }

  function renderSafeRingCard(ring) {
    try {
      return renderRingCard(ring);
    } catch (error) {
      return `
        <article class="rings-card">
          <div class="rings-card-head">
            <div class="rings-card-title"><strong>${escapeHtml(ring.name || `حلقة رقم ${ring.order}`)}</strong></div>
            <span class="rings-status pending">تعذر عرض البطاقة</span>
          </div>
          <dl>
            <div><dt>المدرس</dt><dd>${escapeHtml(ring.teacher || "-")}</dd></div>
            <div><dt>عدد الطلاب</dt><dd>${ring.studentCount || 0}</dd></div>
            <div><dt>الفئة</dt><dd>${escapeHtml(ring.category || "-")}</dd></div>
            <div><dt>الصف</dt><dd>${escapeHtml(ring.grade || "-")}</dd></div>
          </dl>
        </article>
      `;
    }
  }

  function renderSafeRingRow(ring) {
    try {
      return renderRingRow(ring);
    } catch (error) {
      return `
        <tr>
          <td><strong>${escapeHtml(ring.name || `حلقة رقم ${ring.order}`)}</strong></td>
          <td>${escapeHtml(ring.teacher || "-")}</td>
          <td>${escapeHtml(ring.category || "-")}</td>
          <td>${escapeHtml(ring.grade || "-")}</td>
          <td><strong>${ring.studentCount || 0}</strong></td>
          <td><span class="rings-status pending">تعذر عرض التفاصيل</span></td>
          <td><button class="secondary-button compact-button ring-open-button" type="button" data-open-ring="${escapeHtml(ring.id)}">دخول</button></td>
        </tr>
      `;
    }
  }

  function renderRingNameControl(ring) {
    if (!ring.editableName) {
      return `<strong>${escapeHtml(ring.name)}</strong>`;
    }

    return `
      <div class="ring-name-editor">
        <input
          type="text"
          value="${escapeHtml(ring.name)}"
          placeholder="اكتب اسم الحلقة لاحقًا"
          aria-label="اسم الحلقة رقم ${ring.order}"
          data-ring-name-input="${escapeHtml(ring.id)}"
        >
        <button class="secondary-button compact-button" type="button" data-save-ring-name="${escapeHtml(ring.id)}">حفظ</button>
      </div>
      <small class="ring-name-hint">الحلقة رقم ${ring.order} بانتظار الاسم</small>
    `;
  }

  function renderRingCard(ring) {
    const teacher = ring.teacher || "بانتظار التحديد";
    const status = ring.name ? "جاهزة لإضافة الطلاب" : "يمكن تسميتها لاحقًا";
    const statusClass = ring.name ? "ready" : "pending";

    return `
      <article class="rings-card ${ring.name ? "" : "needs-name"}">
        <div class="rings-card-head">
          <div class="rings-card-title">${renderRingNameControl(ring)}</div>
          <span class="rings-status ${statusClass}">${escapeHtml(status)}</span>
        </div>
        <dl>
          <div>
            <dt>المدرس</dt>
            <dd>${escapeHtml(teacher)}</dd>
          </div>
          <div>
            <dt>عدد الطلاب</dt>
            <dd>${ring.studentCount}</dd>
          </div>
          <div>
            <dt>الفئة</dt>
            <dd>${escapeHtml(ring.category || "-")}</dd>
          </div>
          <div>
            <dt>الصف</dt>
            <dd>${escapeHtml(ring.grade || "-")}</dd>
          </div>
        </dl>
        <div class="rings-card-actions">
          <button class="secondary-button ring-open-button" type="button" data-open-ring="${escapeHtml(ring.id)}">الدخول للتفاصيل</button>
        </div>
      </article>
    `;
  }

  function renderRingRow(ring) {
    const teacher = ring.teacher || "بانتظار التحديد";
    const status = ring.name ? "جاهزة لإضافة الطلاب" : "يمكن تسميتها لاحقًا";
    const statusClass = ring.name ? "ready" : "pending";

    return `
      <tr>
        <td>${renderRingNameControl(ring)}</td>
        <td>${escapeHtml(teacher)}</td>
        <td>${escapeHtml(ring.category || "-")}</td>
        <td>${escapeHtml(ring.grade || "-")}</td>
        <td><strong>${ring.studentCount}</strong></td>
        <td><span class="rings-status ${statusClass}">${escapeHtml(status)}</span></td>
        <td><button class="secondary-button compact-button ring-open-button" type="button" data-open-ring="${escapeHtml(ring.id)}">دخول</button></td>
      </tr>
    `;
  }

  function renderRingDetail(ring) {
    const detail = document.getElementById("rings-detail-view");
    if (!detail) return;

    setListVisible(false);
    const students = getStudentsForRing(ring.id);
    const teacher = ring.teacher || "بانتظار التحديد";
    const title = ring.name || `حلقة رقم ${ring.order}`;

    detail.innerHTML = `
      <div class="rings-detail-header">
        <div class="title-block">
          <p class="eyebrow">تفاصيل الحلقة</p>
          <h2>${escapeHtml(title)}</h2>
          <p class="lead">يمكنك إضافة الطلاب لهذه الحلقة والرجوع إلى سجل الحلقات في أي وقت.</p>
        </div>
        <div class="ring-detail-actions">
          <button class="secondary-button ring-students-pdf-button" type="button" data-print-ring-students="${escapeHtml(ring.id)}">أسماء الطلاب PDF</button>
          <button class="ghost-button ring-detail-back" type="button" data-back-to-rings>رجوع</button>
        </div>
      </div>

      <div class="rings-detail-grid">
        <div class="rings-stat">
          <span>اسم الحلقة</span>
          ${ring.editableName ? renderRingNameControl(ring) : `<strong>${escapeHtml(ring.name)}</strong>`}
        </div>
        <div class="rings-stat">
          <span>المدرس</span>
          <strong>${escapeHtml(teacher)}</strong>
        </div>
        <div class="rings-stat">
          <span>الفئة</span>
          <strong>${escapeHtml(ring.category || "-")}</strong>
        </div>
        <div class="rings-stat">
          <span>عدد الطلاب</span>
          <strong>${students.length}</strong>
        </div>
      </div>

      <section class="ring-detail-section" aria-labelledby="ring-student-form-title">
        <div class="section-heading">
          <h3 id="ring-student-form-title">إضافة طالب للحلقة</h3>
        </div>
        <form class="ring-student-form" data-ring-student-form="${escapeHtml(ring.id)}">
          <div class="form-grid">
            <div class="field">
              <label for="ring-student-name">اسم الطالب</label>
              <input id="ring-student-name" name="studentName" type="text" autocomplete="off" required>
            </div>
            <div class="field">
              <label for="ring-student-father">اسم الأب</label>
              <input id="ring-student-father" name="fatherName" type="text" autocomplete="off">
            </div>
            <div class="field">
              <label for="ring-student-phone">رقم ولي الأمر</label>
              <input id="ring-student-phone" name="phone" type="text" autocomplete="off" dir="ltr">
            </div>
            <div class="field">
              <label for="ring-student-notes">ملاحظات</label>
              <input id="ring-student-notes" name="notes" type="text" autocomplete="off">
            </div>
          </div>
          <div class="ring-student-actions">
            <button class="primary-button ring-student-add-button" type="submit">إضافة الطالب</button>
          </div>
        </form>
      </section>

      <section class="ring-detail-section" aria-labelledby="ring-students-title">
        <div class="section-heading">
          <h3 id="ring-students-title">طلاب الحلقة</h3>
          <p class="form-message">${students.length ? `${students.length} طالب` : "لا يوجد طلاب مضافون بعد"}</p>
        </div>
        ${renderRingStudentsTable(ring, students)}
      </section>
    `;
  }

  function renderRingStudentsTable(ring, students) {
    if (!students.length) {
      return `<div class="rings-empty">لم تتم إضافة طلاب لهذه الحلقة بعد.</div>`;
    }

    return `
      <div class="ring-students-table-wrap">
        <table class="ring-students-table">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>اسم الطالب</th>
              <th>اسم الأب</th>
              <th>رقم ولي الأمر</th>
              <th>ملاحظات</th>
              <th>حذف</th>
            </tr>
          </thead>
          <tbody>
            ${students.map((student, index) => `
              <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(student.name)}</strong></td>
                <td>${escapeHtml(student.fatherName || "-")}</td>
                <td><span dir="ltr">${escapeHtml(student.phone || "-")}</span></td>
                <td>${escapeHtml(student.notes || "-")}</td>
                <td>
                  ${student.source === "file"
                    ? `<span class="rings-status ready">من الملف</span>`
                    : `<button class="ghost-button danger-text compact-button ring-student-delete" type="button" data-ring-id="${escapeHtml(ring.id)}" data-delete-ring-student="${escapeHtml(student.id)}">حذف</button>`}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function openRing(ringId) {
    if (!ringId) return;
    window.location.hash = encodeURIComponent(ringId);
  }

  function closeRingDetail() {
    history.pushState("", document.title, window.location.pathname + window.location.search);
    state.selectedRingId = "";
    setListVisible(true);
    renderSummary();
    renderRings();
  }

  function printSelectedCategoryStudents() {
    if (!state.category) {
      alert("اختر فئة محددة أولًا لطباعة أسماء طلابها.");
      return;
    }

    const ringGroups = getRings()
      .filter((ring) => ring.category === state.category)
      .map((ring) => ({
        ring,
        students: getStudentsForRing(ring.id),
      }))
      .filter((group) => group.students.length);

    const totalStudents = ringGroups.reduce((total, group) => total + group.students.length, 0);
    if (!totalStudents) {
      alert("لا يوجد طلاب ضمن هذه الفئة لطباعة ملف PDF.");
      return;
    }

    startPrint(buildCategoryStudentsPrintReport(state.category, ringGroups, totalStudents));
  }

  function printRingStudents(ringId) {
    const ring = getRingById(ringId);
    if (!ring) return;

    const students = getStudentsForRing(ringId);
    if (!students.length) {
      alert("لا يوجد طلاب ضمن هذه الحلقة لطباعة ملف PDF.");
      return;
    }

    startPrint(buildRingStudentsPrintReport(ring, students));
  }

  function startPrint(markup) {
    const printRoot = document.getElementById("print-root");
    if (!printRoot) return;

    printRoot.innerHTML = markup;
    document.body.classList.add("printing");
    setTimeout(() => window.print(), 80);
  }

  function getPrintHeaderMarkup() {
    return `
      <header class="print-header">
        <div class="print-brand-copy">
          <h1>مسجد قباء</h1>
          <p>سجل حلقات المسجد</p>
        </div>
        <img class="print-logo" src="assets/qobaa-logo-vertical.png" alt="شعار مسجد قباء">
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

  function buildTwoColumnStudentRows(students) {
    const splitIndex = Math.ceil(students.length / 2);
    const firstColumnStudents = students.slice(0, splitIndex);
    const secondColumnStudents = students.slice(splitIndex);

    return firstColumnStudents.map((student, index) => {
      const pairedStudent = secondColumnStudents[index];
      return `
        <tr>
          <td>${(index + 1).toLocaleString("ar-SY")}</td>
          <td><strong>${escapeHtml(student.name)}</strong></td>
          <td>${pairedStudent ? (splitIndex + index + 1).toLocaleString("ar-SY") : ""}</td>
          <td>${pairedStudent ? `<strong>${escapeHtml(pairedStudent.name)}</strong>` : ""}</td>
        </tr>
      `;
    }).join("");
  }

  function buildRingStudentsPrintReport(ring, students) {
    const title = ring.name || `حلقة رقم ${ring.order}`;
    const teacher = ring.teacher || "غير محدد";
    const rows = buildTwoColumnStudentRows(students);

    return `
      <article class="print-report ring-students-print-report">
        <section class="print-sheet ring-students-print-sheet">
          ${getPrintHeaderMarkup()}

          <div class="ring-students-print-title">
            <p>كشف أسماء طلاب الحلقة</p>
            <h2>${escapeHtml(title)}</h2>
          </div>

          <div class="ranking-print-summary ring-students-print-summary">
            <div><strong>الحلقة:</strong> ${escapeHtml(title)}</div>
            <div><strong>المدرس:</strong> ${escapeHtml(teacher)}</div>
            <div><strong>الفئة:</strong> ${escapeHtml(ring.category || "-")}</div>
            <div><strong>الصف:</strong> ${escapeHtml(ring.grade || "-")}</div>
            <div><strong>عدد الطلاب:</strong> ${students.length.toLocaleString("ar-SY")}</div>
            <div><strong>نوع الكشف:</strong> أسماء الطلاب</div>
          </div>

          <table class="print-table ring-students-print-table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>اسم الطالب</th>
                <th>الرقم</th>
                <th>اسم الطالب</th>
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

  function buildCategoryStudentsPrintReport(categoryName, ringGroups, totalStudents) {
    return ringGroups.map(({ ring, students }, index) => {
      const title = ring.name || `حلقة رقم ${ring.order}`;
      const teacher = ring.teacher || "غير محدد";
      const rows = buildTwoColumnStudentRows(students);

      return `
        <article class="print-report ring-students-print-report category-students-print-report">
          <section class="print-sheet ring-students-print-sheet">
            ${getPrintHeaderMarkup()}

            <div class="ring-students-print-title">
              <p>كشف أسماء طلاب الفئة</p>
              <h2>${escapeHtml(categoryName)}</h2>
            </div>

            <div class="ranking-print-summary ring-students-print-summary">
              <div><strong>الفئة:</strong> ${escapeHtml(categoryName)}</div>
              <div><strong>الحلقة:</strong> ${escapeHtml(title)}</div>
              <div><strong>المدرس:</strong> ${escapeHtml(teacher)}</div>
              <div><strong>الصف:</strong> ${escapeHtml(ring.grade || "-")}</div>
              <div><strong>طلاب هذه الحلقة:</strong> ${students.length.toLocaleString("ar-SY")}</div>
              <div><strong>إجمالي الفئة:</strong> ${totalStudents.toLocaleString("ar-SY")}</div>
            </div>

            <table class="print-table ring-students-print-table">
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>اسم الطالب</th>
                  <th>الرقم</th>
                  <th>اسم الطالب</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

            <div class="category-students-print-footer">
              <span>صفحة ${(index + 1).toLocaleString("ar-SY")} من ${ringGroups.length.toLocaleString("ar-SY")}</span>
            </div>

            <div class="print-signature-row">
              ${getDirectorSignatureMarkup()}
            </div>
          </section>
        </article>
      `;
    }).join("");
  }

  function setListVisible(isVisible) {
    const tools = document.getElementById("rings-list-tools");
    const list = document.getElementById("rings-list-panel");
    const detail = document.getElementById("rings-detail-view");

    if (tools) tools.hidden = !isVisible;
    if (list) list.hidden = !isVisible;
    if (detail) detail.hidden = isVisible;
  }

  function addRingStudent(ringId, form) {
    const ring = getRingById(ringId);
    if (!ring) return;

    const formData = new FormData(form);
    const name = String(formData.get("studentName") || "").trim();
    if (!name) return;

    const allStudents = loadRingStudents();
    const students = allStudents[ringId] || [];
    students.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      fatherName: String(formData.get("fatherName") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
      source: "local",
    });

    allStudents[ringId] = students;
    saveRingStudents(allStudents);
    form.reset();
    renderSummary();
    renderRingDetail(getRingById(ringId));
  }

  function deleteRingStudent(ringId, studentId) {
    const allStudents = loadRingStudents();
    allStudents[ringId] = (allStudents[ringId] || []).filter((student) => student.id !== studentId);
    saveRingStudents(allStudents);
    renderSummary();
    renderRingDetail(getRingById(ringId));
  }

  function saveRingName(ringId, editor) {
    if (!ringId) return;
    const input = editor?.querySelector("[data-ring-name-input]")
      || document.querySelector(`[data-ring-name-input="${cssEscape(ringId)}"]`);
    if (!input) return;

    const edits = loadNameEdits();
    const value = input.value.trim();
    if (value) {
      edits[ringId] = value;
    } else {
      delete edits[ringId];
    }

    localStorage.setItem(RING_NAME_EDITS_KEY, JSON.stringify(edits));
    renderSummary();
    const ring = getRingById(ringId);
    if (state.selectedRingId === ringId && ring) {
      renderRingDetail(ring);
    } else {
      renderRings();
    }
  }

  function getFilteredRings() {
    const query = normalize(state.query);
    return getRings().filter((ring) => {
      const matchesCategory = !state.category || ring.category === state.category;
      const matchesQuery = !query || normalize([
        ring.name,
        ring.teacher,
        ring.category,
        ring.grade,
        ring.order,
      ].join(" ")).includes(query);
      return matchesCategory && matchesQuery;
    });
  }

  function getRings() {
    const edits = loadNameEdits();
    const localStudents = loadRingStudents();
    const baseStudents = getBaseRingStudents();
    return (dataset.rings || []).map((ring) => {
      const editedName = ring.name ? "" : (edits[ring.id] || "");
      const name = editedName || ring.name || "";
      return {
        ...ring,
        name,
        editableName: !ring.name,
        studentCount: (baseStudents[ring.id] || []).length + (localStudents[ring.id] || []).length,
      };
    });
  }

  function getRingById(ringId) {
    return getRings().find((ring) => ring.id === ringId);
  }

  function getStudentsForRing(ringId) {
    const baseStudents = (getBaseRingStudents()[ringId] || []).map((student, index) => ({
      ...student,
      id: student.id || `${ringId}-source-${index + 1}`,
      source: "file",
    }));
    const localStudents = (loadRingStudents()[ringId] || []).map((student) => ({
      ...student,
      source: student.source || "local",
    }));
    return [...baseStudents, ...localStudents];
  }

  function getBaseRingStudents() {
    return dataset.studentsByRing || {};
  }

  function loadNameEdits() {
    try {
      return JSON.parse(localStorage.getItem(RING_NAME_EDITS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function loadRingStudents() {
    try {
      return JSON.parse(localStorage.getItem(RING_STUDENTS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveRingStudents(students) {
    localStorage.setItem(RING_STUDENTS_KEY, JSON.stringify(students));
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
    const seen = new Set();
    const values = [];
    items.forEach((item) => {
      const value = item[key];
      if (!value || seen.has(value)) return;
      seen.add(value);
      values.push(value);
    });
    return values;
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

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/"/g, '\\"');
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
