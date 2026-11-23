/* ============================================================
   AUREA SALÓN — Configuración central
   Este es el ÚNICO archivo que necesitas tocar para cambiar
   marca, contacto, horarios y la conexión con Google Sheets.
   ============================================================ */

window.SALON_CONFIG = {
  brand: {
    name: "Aurea Salón",
    shortName: "Aurea",
    monogram: "AU",
    tagline: "Tu belleza, en su mejor luz.",
    established: "2018",
    city: "San Salvador, El Salvador",
  },

  contact: {
    phone: "",
    whatsapp: "", // Número de WhatsApp del negocio en formato internacional, sin + ni espacios.
    email: "",
    address: "",
    instagram: "aurea.salon",
    mapsUrl: "https://maps.google.com/?q=San+Salvador,+El+Salvador",
  },

  currency: {
    code: "USD",
    locale: "es-SV",
  },

  schedule: {
    open: "09:00",
    close: "19:00",
    slotMinutes: 30,
    closedDays: [0], // 0 = domingo, 1 = lunes ... 6 = sábado
    leadTimeMinutes: 60, // anticipación mínima para reservar hoy
    maxDaysAhead: 45,
  },

  api: {
    // Pega aquí la URL del Web App de Apps Script (termina en /exec).
    // Si lo dejas vacío, la página funciona como demo funcional con datos locales.
    url: "https://script.google.com/macros/s/AKfycbw1FmzhziUMLL3f-g8FdvytYj9GYPRQbSxmfAHsLZqQOFzWexnikpw7HZTT6AzgXV9x4Q/exec",
  },

  admin: {
    // Clave del panel en demo funcional. Con Sheets se usa la clave del Apps Script.
    demoKey: "aurea2026",
  },

  /* Datos iniciales. En modo Sheets se copian a la hoja la primera vez. */
  services: [
    { id: "srv-corte", nombre: "Corte de cabello", descripcion: "Corte a medida con lavado y peinado final.", duracion_min: 45, precio: 18, activo: true, orden: 1 },
    { id: "srv-planchado", nombre: "Planchado", descripcion: "Alisado con plancha y protección térmica.", duracion_min: 45, precio: 16, activo: true, orden: 2 },
    { id: "srv-maquillaje", nombre: "Maquillaje", descripcion: "Maquillaje social con acabado luminoso.", duracion_min: 60, precio: 30, activo: true, orden: 3 },
    { id: "srv-manicure", nombre: "Manicure", descripcion: "Cuidado de manos, limado y esmalte.", duracion_min: 45, precio: 14, activo: true, orden: 4 },
    { id: "srv-pedicure", nombre: "Pedicure", descripcion: "Exfoliación, hidratación y esmalte.", duracion_min: 60, precio: 20, activo: true, orden: 5 },
    { id: "srv-masaje", nombre: "Masaje relajante", descripcion: "Masaje corporal para soltar tensión.", duracion_min: 60, precio: 35, activo: true, orden: 6 },
    { id: "srv-combo-mani-pedi", nombre: "Combo manicure + pedicure", descripcion: "Manos y pies completos en una sola cita.", duracion_min: 90, precio: 30, activo: true, orden: 7 },
    { id: "srv-combo-novia", nombre: "Combo novia", descripcion: "Prueba de maquillaje y peinado para tu gran día.", duracion_min: 120, precio: 80, activo: true, orden: 8 },
    { id: "srv-color", nombre: "Color y balayage", descripcion: "Coloración, mechas o balayage con acabado profesional.", duracion_min: 120, precio: 55, activo: true, orden: 9 },
    { id: "srv-keratina", nombre: "Keratina", descripcion: "Alisado progresivo y brillo espejo.", duracion_min: 120, precio: 65, activo: true, orden: 10 },
    { id: "srv-facial", nombre: "Facial hidratante", descripcion: "Limpieza, mascarilla e hidratación profunda.", duracion_min: 60, precio: 38, activo: true, orden: 11 },
    { id: "srv-cejas", nombre: "Cejas y pestañas", descripcion: "Diseño de cejas, tinte y lifting de pestañas.", duracion_min: 30, precio: 12, activo: true, orden: 12 },
    { id: "srv-peinado", nombre: "Peinado", descripcion: "Ondas, recogidos o peinado de evento.", duracion_min: 45, precio: 22, activo: true, orden: 13 },
    { id: "srv-depilacion", nombre: "Depilación con cera", descripcion: "Depilación facial o corporal con cera tibia.", duracion_min: 30, precio: 15, activo: true, orden: 14 },
  ],

  estilistas: [
    { id: "est-daniela", nombre: "Daniela Rivas", rol: "Fundadora", especialidad: "Color y balayage", telefono: "", comision_pct: 50, activo: true, color: "#C9A227", clave: "daniela2026" },
    { id: "est-valeria", nombre: "Valeria Cruz", rol: "Estilista senior", especialidad: "Cortes y peinados", telefono: "", comision_pct: 45, activo: true, color: "#D9A6A0", clave: "valeria2026" },
    { id: "est-camila", nombre: "Camila Flores", rol: "Estilista", especialidad: "Manicure y pedicure", telefono: "", comision_pct: 40, activo: true, color: "#B8A48A", clave: "camila2026" },
    { id: "est-sofia", nombre: "Sofía Méndez", rol: "Especialista", especialidad: "Maquillaje y cejas", telefono: "", comision_pct: 40, activo: true, color: "#A98BB0", clave: "sofia2026" },
  ],
};
