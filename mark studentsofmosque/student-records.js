(() => {
  const RING_NAME_EDITS_KEY = "qobaa-mosque-ring-name-edits-v1";
  const RING_STUDENTS_KEY = "qobaa-mosque-ring-students-v1";
  const STUDENT_PROFILE_EDITS_KEY = "qobaa-student-profile-edits-v1";
  const STUDENT_PROFILE_EDIT_FIELDS = [
    "fullName",
    "fatherName",
    "motherName",
    "birthYear",
    "grade",
    "schoolName",
    "residence",
    "fatherPhone",
    "motherPhone",
    "studentPhone",
    "memorizationLevel",
  ];

  function buildDataset() {
    const baseStudentInfo = window.STUDENT_INFO_DATA || { meta: {}, sections: [], columns: [], students: [] };
    const ringsDataset = window.MOSQUE_RINGS_DATA;
    if (!ringsDataset || !Array.isArray(ringsDataset.rings)) {
      return baseStudentInfo;
    }

    const nameEdits = readJsonStorage(RING_NAME_EDITS_KEY);
    const localStudentsByRing = readJsonStorage(RING_STUDENTS_KEY);
    const studentProfileEdits = readJsonStorage(STUDENT_PROFILE_EDITS_KEY);
    const baseStudentsByRing = ringsDataset.studentsByRing || {};
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
      const sectionName = ring.name || nameEdits[ring.id] || fallbackName;
      sections.push({
        id: ring.id,
        name: sectionName,
        teacher: ring.teacher || "",
        category: ring.category || "",
        grade: ring.grade || "",
        total: ringStudents.length,
      });

      ringStudents.forEach((student) => {
        const source = student.source === "local" ? "من الإضافة اليدوية" : "من حلقات المسجد";
        const record = {
          id: student.id,
          ringId: ring.id,
          serial: String(students.length + 1),
          name: student.name,
          fullName: student.fullName || student.name || "",
          sectionName,
          school: ring.teacher || "",
          category: ring.category || "",
          grade: student.grade || ring.grade || "",
          notes: source,
          source,
          fatherName: student.fatherName || "",
          motherName: student.motherName || "",
          birthYear: student.birthYear || "",
          schoolName: student.schoolName || "",
          residence: student.residence || "",
          fatherPhone: student.fatherPhone || student.phone || "",
          motherPhone: student.motherPhone || "",
          studentPhone: student.studentPhone || "",
          memorizationLevel: student.memorizationLevel || "",
          phone: student.phone || "",
        };
        students.push(applyStudentProfileEdits(record, studentProfileEdits[record.id]));
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
      columns: getDefaultColumns(),
      students,
    };
  }

  function getDefaultColumns() {
    return [
      { key: "serial", label: "الرقم" },
      { key: "name", label: "اسم الطالب" },
      { key: "sectionName", label: "الحلقة" },
      { key: "school", label: "المدرس" },
      { key: "category", label: "الفئة" },
      { key: "grade", label: "الصف" },
    ];
  }

  function readJsonStorage(key) {
    try {
      if (typeof localStorage === "undefined") return {};
      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch {
      return {};
    }
  }

  function applyStudentProfileEdits(student, edits = {}) {
    const cleanedEdits = {};
    STUDENT_PROFILE_EDIT_FIELDS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(edits, key)) {
        cleanedEdits[key] = String(edits[key] ?? "").trim();
      }
    });

    const merged = {
      ...student,
      ...cleanedEdits,
    };

    if (cleanedEdits.fullName) {
      merged.name = cleanedEdits.fullName;
    }

    if (cleanedEdits.fatherPhone) {
      merged.phone = cleanedEdits.fatherPhone;
    }

    return merged;
  }

  function saveStudentProfileEdits(studentId, fields = {}) {
    if (!studentId || typeof localStorage === "undefined") return;

    const edits = readJsonStorage(STUDENT_PROFILE_EDITS_KEY);
    const nextFields = {};
    STUDENT_PROFILE_EDIT_FIELDS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        nextFields[key] = String(fields[key] ?? "").trim();
      }
    });

    edits[studentId] = {
      ...(edits[studentId] || {}),
      ...nextFields,
    };
    localStorage.setItem(STUDENT_PROFILE_EDITS_KEY, JSON.stringify(edits));
  }

  function findStudentById(studentId, dataset = buildDataset()) {
    return (dataset.students || []).find((student) => student.id === studentId) || null;
  }

  window.QOBAA_STUDENT_RECORDS = {
    buildDataset,
    findStudentById,
    saveStudentProfileEdits,
    applyStudentProfileEdits,
  };
})();
