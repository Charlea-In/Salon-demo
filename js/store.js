/* ============================================================
   STORE — capa de datos
   Demo funcional: localStorage (funciona sin configurar nada)
   Modo Sheets: POST al Web App de Google Apps Script
   La interfaz pública y el panel usan exactamente la misma API.
   ============================================================ */
(function () {
  const C = window.SALON_CONFIG;
  const U = window.UI;

  const DEMO = !C.api.url;
  const DB_KEY = "aurea_salon_db_v1";
  const KEY_STORE = "aurea_admin_key";

  let schedule = scheduleFrom({});
  let adminKey = sessionStorage.getItem(KEY_STORE) || "";

  /* ---------- Horario a partir de la config ---------- */
  function scheduleFrom(config) {
    const open = config.hora_inicio || C.schedule.open;
    const close = config.hora_fin || C.schedule.close;
    const closedRaw = config.dias_cerrados !== undefined ? config.dias_cerrados : C.schedule.closedDays.join(",");
    const closedDays = String(closedRaw)
      .split(",")
      .map((n) => Number(String(n).trim()))
      .filter((n) => !Number.isNaN(n));
    return {
      open,
      close,
      openMin: U.minutesFromTime(open),
      closeMin: U.minutesFromTime(close),
      slotMinutes: Number(config.slot_minutos) || C.schedule.slotMinutes,
      closedDays,
      leadMinutes: Number(config.lead_minutos ?? C.schedule.leadTimeMinutes) || 0,
    };
  }

  /* ---------- Utilidades demo ---------- */
  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const db = JSON.parse(raw);
        if (db && db.version === 1) {
          db.availabilityBlocks = db.availabilityBlocks || [];
          if (assignDemoClientCodes(db)) saveDB(db);
          return db;
        }
      }
    } catch (e) {
      console.warn("No se pudo leer la base demo, se regenera.", e);
    }
    const db = seedDB();
    assignDemoClientCodes(db);
    saveDB(db);
    return db;
  }

  function shortCode(id) {
    return String(id || "")
      .replace(/[^a-z0-9]/gi, "")
      .slice(-6)
      .toUpperCase();
  }

  function nextClientCode(clients) {
    const highest = clients.reduce((max, client) => {
      const match = String(client.codigo_cliente || "").match(/^AS-(\d+)$/i);
      return match ? Math.max(max, Number(match[1]) || 0) : max;
    }, 0);
    return `AS-${String(highest + 1).padStart(2, "0")}`;
  }

  function assignDemoClientCodes(db) {
    let changed = false;
    (db.clients || []).forEach((client) => {
      if (client.codigo_cliente) return;
      client.codigo_cliente = nextClientCode(db.clients);
      changed = true;
    });
    return changed;
  }

  function clientNameKey(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function findDemoClientByCredentials(db, payload) {
    const code = String(payload.codigo_cliente || "").trim().toUpperCase();
    const name = clientNameKey(payload.nombre);
    const phone = U.normalizePhone(payload.telefono);
    if (!/^AS-\d{2,}$/.test(code) || name.length < 2 || phone.length !== 8) {
      throw new Error("Revisa tu código de cliente, nombre y teléfono.");
    }
    const client = (db.clients || []).find((item) =>
      String(item.codigo_cliente || "").toUpperCase() === code &&
      clientNameKey(item.nombre) === name &&
      U.normalizePhone(item.telefono) === phone
    );
    if (!client) throw new Error("No encontramos un cliente con esos datos. Revisa tu información o continúa como cliente nuevo.");
    return client;
  }

  function publicAppointment(a) {
    return {
      id: a.id,
      codigo: shortCode(a.id),
      fecha: a.fecha,
      hora: a.hora,
      cliente_nombre: a.cliente_nombre,
      cliente_telefono: a.cliente_telefono,
      servicio_id: a.servicio_id,
      servicio_nombre: a.servicio_nombre,
      estilista_id: a.estilista_id,
      estilista_nombre: a.estilista_nombre,
      precio: Number(a.precio) || 0,
      duracion_min: Number(a.duracion_min) || 30,
      estado: a.estado,
      notas: a.notas || "",
      creado_en: a.creado_en || "",
    };
  }

  // Lo que puede ver el sitio público de una estilista (sin clave ni comisión).
  function publicEstilista(b) {
    return {
      id: b.id,
      nombre: b.nombre,
      rol: b.rol || "",
      especialidad: b.especialidad || "",
      activo: b.activo !== false,
      color: b.color || "#C9A227",
    };
  }

  // Lo que ve la propia estilista en su panel.
  function selfEstilista(b) {
    return {
      ...publicEstilista(b),
      comision_pct: Number(b.comision_pct) || 0,
    };
  }

  function recomputeClient(db, clientId) {
    const client = db.clients.find((c) => c.id === clientId);
    if (!client) return;
    const done = db.appointments.filter((a) => a.cliente_id === clientId && a.estado === "completada");
    client.total_citas = done.length;
    client.total_gastado = U.sum(done, "precio");
    client.ultima_visita = done.reduce((max, a) => (a.fecha > max ? a.fecha : max), "");
  }

  function ensureClient(db, data) {
    const phone = U.normalizePhone(data.cliente_telefono || data.telefono);
    let client = null;
    if (data.cliente_id) client = db.clients.find((c) => c.id === data.cliente_id) || null;
    if (!client && phone) client = db.clients.find((c) => U.normalizePhone(c.telefono) === phone) || null;

    if (!client) {
      client = {
        id: U.uid("cl"),
        codigo_cliente: nextClientCode(db.clients),
        nombre: data.cliente_nombre || data.nombre || "Cliente",
        telefono: data.cliente_telefono || data.telefono || "",
        email: data.cliente_email || data.email || "",
        notas: "",
        creado_en: U.todayISO(),
        total_citas: 0,
        total_gastado: 0,
        ultima_visita: "",
      };
      db.clients.push(client);
    } else {
      if (!client.codigo_cliente) client.codigo_cliente = nextClientCode(db.clients);
      if (data.cliente_nombre || data.nombre) client.nombre = data.cliente_nombre || data.nombre;
      if (data.cliente_email || data.email) client.email = data.cliente_email || data.email;
    }
    return client;
  }

  function sortAppointments(list) {
    return [...list].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }

  function computeAvailability(db, { date, serviceId, estilistaId }) {
    const sch = scheduleFrom(db.config);
    const svc = db.services.find((s) => s.id === serviceId && s.activo !== false);
    if (!svc) throw new Error("El servicio ya no está disponible.");
    if (!date) throw new Error("Falta la fecha.");

    const d = U.parseISO(date);
    if (Number.isNaN(d.getTime())) throw new Error("Fecha inválida.");
    if (sch.closedDays.includes(d.getDay())) return { date, closed: true, slots: [] };
    if (date < U.todayISO()) return { date, closed: false, slots: [] };

    const estilistas = db.estilistas.filter(
      (b) => b.activo !== false && (!estilistaId || estilistaId === "any" || b.id === estilistaId)
    );
    if (!estilistas.length) return { date, closed: false, slots: [] };

    const busyAppts = db.appointments.filter(
      (a) => a.fecha === date && !["cancelada", "no_asistio"].includes(a.estado)
    );
    const blocks = (db.availabilityBlocks || []).filter((x) => x.fecha === date && x.estado !== "Disponible");
    const duration = Number(svc.duracion_min) || 30;
    const minStart = date === U.todayISO() ? U.nowMinutes() + sch.leadMinutes : -1;
    const slots = [];

    for (let t = sch.openMin; t + duration <= sch.closeMin; t += sch.slotMinutes) {
      if (t < minStart) continue;
      const available = estilistas.filter((b) => {
        const busy = busyAppts
          .filter((a) => a.estilista_id === b.id)
          .map((a) => [U.minutesFromTime(a.hora), U.minutesFromTime(a.hora) + (Number(a.duracion_min) || 30)]);
        const blocked = blocks.filter((x) => x.estilista_id === b.id).some((x) => t < U.minutesFromTime(x.hora_fin) && t + duration > U.minutesFromTime(x.hora_inicio));
        return !blocked && !busy.some(([start, end]) => t < end && t + duration > start);
      });
      if (available.length) slots.push({ time: U.timeFromMinutes(t), estilistas: available.map((b) => b.id) });
    }
    return { date, closed: false, slots };
  }

  /* ---------- Datos de demostración ---------- */
  function seedDB() {
    let seed = 20261111;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));

    const config = {
      nombre_negocio: C.brand.name,
      ciudad: C.brand.city,
      telefono: C.contact.phone,
      whatsapp: C.contact.whatsapp,
      email: C.contact.email,
      direccion: C.contact.address,
      instagram: C.contact.instagram,
      moneda: C.currency.code,
      hora_inicio: C.schedule.open,
      hora_fin: C.schedule.close,
      slot_minutos: String(C.schedule.slotMinutes),
      dias_cerrados: C.schedule.closedDays.join(","),
      lead_minutos: String(C.schedule.leadTimeMinutes),
    };

    const services = C.services.map((s) => ({ ...s }));
    const estilistas = C.estilistas.map((b) => ({ ...b }));

    const clientSeeds = [
      ["Andrea Villalobos", "00000001", "andrea.v@example.com"],
      ["Beatriz Castañeda", "00000002", "beatriz.c@example.com"],
      ["Carla Mendoza", "00000003", "carla.m@example.com"],
      ["Daniela Ortega", "00000004", "daniela.o@example.com"],
      ["Elena Rivas", "00000005", "elena.r@example.com"],
      ["Fernanda Lozano", "00000006", "fer.lozano@example.com"],
      ["Gabriela Domínguez", "00000007", "gabriela.d@example.com"],
      ["Helena Barrera", "00000008", "helena.b@example.com"],
      ["Irene Salgado", "00000009", "irene.s@example.com"],
      ["Julia Paredes", "00000010", "julia.p@example.com"],
      ["Karla Aguilar", "00000011", "karla.a@example.com"],
      ["Lucía Trejo", "00000012", "lucia.t@example.com"],
    ];
    const clients = clientSeeds.map(([nombre, telefono, email], i) => ({
      id: `cl-demo-${i + 1}`,
      codigo_cliente: `AS-${String(i + 1).padStart(2, "0")}`,
      nombre,
      telefono,
      email,
      notas: i % 4 === 0 ? "Prefiere esmalte en tono nude." : "",
      creado_en: U.addDays(U.todayISO(), -randInt(30, 240)),
      total_citas: 0,
      total_gastado: 0,
      ultima_visita: "",
    }));

    const openMin = U.minutesFromTime(config.hora_inicio);
    const closeMin = U.minutesFromTime(config.hora_fin);
    const slot = Number(config.slot_minutos);
    const closed = config.dias_cerrados.split(",").map(Number);
    const base = U.todayISO();
    const nowMin = U.nowMinutes();
    const appointments = [];
    const incomes = [];
    const activeServices = services.filter((s) => s.activo !== false);

    for (let offset = -60; offset <= 14; offset++) {
      const iso = U.addDays(base, offset);
      const dayOfWeek = U.parseISO(iso).getDay();
      if (closed.includes(dayOfWeek)) continue;

      estilistas.forEach((estilista) => {
        let t = openMin;
        while (t + slot <= closeMin) {
          const probability = offset < 0 ? 0.4 : offset === 0 ? 0.34 : 0.24;
          if (rnd() < probability) {
            const svc = pick(activeServices);
            if (t + svc.duracion_min <= closeMin) {
              const client = rnd() < 0.42 ? clients[0] : pick(clients);
              let estado;
              if (offset < 0) estado = rnd() < 0.9 ? "completada" : rnd() < 0.5 ? "cancelada" : "no_asistio";
              else if (offset === 0) estado = t + svc.duracion_min <= nowMin ? "completada" : rnd() < 0.55 ? "confirmada" : "pendiente";
              else estado = rnd() < 0.3 ? "confirmada" : "pendiente";

              const id = `apt-${offset}-${estilista.id.slice(-4)}-${t}`;
              const realMin = estado === "completada" ? Math.max(5, svc.duracion_min + randInt(-4, 9)) : 0;
              const inicio = U.timeFromMinutes(t);
              const fin = U.timeFromMinutes(t + realMin);
              const appt = {
                id,
                fecha: iso,
                hora: U.timeFromMinutes(t),
                cliente_id: client.id,
                cliente_nombre: client.nombre,
                cliente_telefono: client.telefono,
                servicio_id: svc.id,
                servicio_nombre: svc.nombre,
                estilista_id: estilista.id,
                estilista_nombre: estilista.nombre,
                precio: svc.precio,
                duracion_min: svc.duracion_min,
                estado,
                notas: rnd() < 0.12 ? "Cliente frecuente. Prefiere té sin azúcar." : "",
                creado_en: `${U.addDays(iso, -randInt(1, 12))}T${U.timeFromMinutes(randInt(9 * 60, 20 * 60))}:00`,
                origen: rnd() < 0.55 ? "web" : "mostrador",
                inicio_en: estado === "completada" ? `${iso}T${inicio}:00` : "",
                fin_en: estado === "completada" ? `${iso}T${fin}:00` : "",
                duracion_real_min: realMin,
              };
              appointments.push(appt);

              if (estado === "completada") {
                incomes.push({
                  id: `inc-${offset}-${estilista.id.slice(-4)}-${t}`,
                  fecha: iso,
                  monto: svc.precio,
                  categoria: "Servicio",
                  descripcion: `${svc.nombre} · ${client.nombre}`,
                  cita_id: id,
                  metodo_pago: pick(["Efectivo", "Efectivo", "Tarjeta", "Transferencia"]),
                  estilista_id: estilista.id,
                  creado_en: `${iso}T${U.timeFromMinutes(t)}:00`,
                });
              }
              t += svc.duracion_min;
              continue;
            }
          }
          t += slot;
        }
      });
    }

    // Ventas de producto
    const products = [
      ["Aceite capilar", 18],
      ["Mascarilla de keratina", 24],
      ["Esmalte semipermanente", 12],
      ["Crema de manos", 10],
      ["Sérum facial", 28],
    ];
    for (let i = 0; i < 9; i++) {
      const [nombre, monto] = pick(products);
      const fecha = U.addDays(base, -randInt(0, 32));
      incomes.push({
        id: `inc-prod-${i + 1}`,
        fecha,
        monto,
        categoria: "Productos",
        descripcion: nombre,
        cita_id: "",
        metodo_pago: pick(["Efectivo", "Tarjeta"]),
        estilista_id: "",
        creado_en: `${fecha}T13:00:00`,
      });
    }

    // Gastos
    const thisMonth = U.startOfMonth(base);
    const prevMonthStart = U.startOfMonth(U.addDays(thisMonth, -1));
    const expenses = [
      { id: "exp-1", fecha: thisMonth, monto: 950, categoria: "Renta", descripcion: "Renta del local", metodo_pago: "Transferencia", creado_en: `${thisMonth}T09:00:00` },
      { id: "exp-2", fecha: prevMonthStart, monto: 950, categoria: "Renta", descripcion: "Renta del local", metodo_pago: "Transferencia", creado_en: `${prevMonthStart}T09:00:00` },
      { id: "exp-3", fecha: U.addDays(base, -randInt(2, 6)), monto: 245, categoria: "Insumos", descripcion: "Tintes, esmaltes y toallas", metodo_pago: "Tarjeta", creado_en: `${base}T10:00:00` },
      { id: "exp-4", fecha: U.addDays(base, -randInt(7, 12)), monto: 168, categoria: "Insumos", descripcion: "Productos de venta y cuidado", metodo_pago: "Efectivo", creado_en: `${base}T10:00:00` },
      { id: "exp-5", fecha: U.addDays(base, -randInt(13, 18)), monto: 98, categoria: "Servicios", descripcion: "Luz y agua", metodo_pago: "Transferencia", creado_en: `${base}T10:00:00` },
      { id: "exp-6", fecha: U.addDays(base, -randInt(19, 24)), monto: 150, categoria: "Marketing", descripcion: "Pauta en Instagram", metodo_pago: "Tarjeta", creado_en: `${base}T10:00:00` },
      { id: "exp-7", fecha: U.addDays(base, -randInt(25, 30)), monto: 320, categoria: "Equipo", descripcion: "Mantenimiento de secadoras", metodo_pago: "Transferencia", creado_en: `${base}T10:00:00` },
      { id: "exp-8", fecha: U.addDays(base, -randInt(31, 38)), monto: 87, categoria: "Insumos", descripcion: "Café, agua y limpieza", metodo_pago: "Efectivo", creado_en: `${base}T10:00:00` },
    ];

    const db = {
      version: 1,
      config,
      services,
      estilistas,
      clients,
      appointments: sortAppointments(appointments),
      incomes,
      expenses,
      availabilityBlocks: [],
      seeded_at: new Date().toISOString(),
    };

    clients.forEach((c) => recomputeClient(db, c.id));
    return db;
  }

  /* ---------- Acciones demo ---------- */
  function demoBootstrap() {
    const db = loadDB();
    const data = {
      services: db.services.filter((s) => s.activo !== false).sort((a, b) => Number(a.orden) - Number(b.orden)),
      estilistas: db.estilistas.filter((b) => b.activo !== false).map(publicEstilista),
      config: { ...db.config },
    };
    data.schedule = scheduleFrom(data.config);
    return data;
  }

  function demoAvailability(payload) {
    return computeAvailability(loadDB(), payload);
  }

  function demoBook(payload) {
    const db = loadDB();
    const nombre = String(payload.cliente_nombre || "").trim();
    const telefono = String(payload.cliente_telefono || "").trim();
    if (nombre.length < 2) throw new Error("Escribe tu nombre completo.");
    if (U.normalizePhone(telefono).length !== 8) throw new Error("Escribe un teléfono salvadoreño de 8 dígitos.");
    if (!payload.fecha || !payload.hora) throw new Error("Elige fecha y hora.");
    const returningClient = payload.codigo_cliente
      ? findDemoClientByCredentials(db, { codigo_cliente: payload.codigo_cliente, nombre, telefono })
      : null;

    const svc = db.services.find((s) => s.id === payload.servicio_id && s.activo !== false);
    if (!svc) throw new Error("El servicio ya no está disponible.");

    const availability = computeAvailability(db, {
      date: payload.fecha,
      serviceId: payload.servicio_id,
      estilistaId: payload.estilista_id || "any",
    });
    if (availability.closed) throw new Error("Ese día el salón está cerrado.");
    const slot = availability.slots.find((s) => s.time === payload.hora);
    if (!slot) {
      const start = U.minutesFromTime(payload.hora), end = start + (Number(svc.duracion_min) || 30);
      const blocked = (db.availabilityBlocks || []).some((x) => x.fecha === payload.fecha && x.estado !== "Disponible" && (!payload.estilista_id || payload.estilista_id === "any" || x.estilista_id === payload.estilista_id) && start < U.minutesFromTime(x.hora_fin) && end > U.minutesFromTime(x.hora_inicio));
      if (blocked) throw new Error("La estilista no está disponible en ese horario. Elige otra hora.");
      throw new Error("Ese horario acaba de ocuparse. Elige otro.");
    }
    const estilistaId = payload.estilista_id && payload.estilista_id !== "any" ? payload.estilista_id : slot.estilistas[0];
    if (!slot.estilistas.includes(estilistaId)) throw new Error("Esa estilista ya no tiene espacio a esa hora.");
    const estilista = db.estilistas.find((b) => b.id === estilistaId);
    if (!estilista) throw new Error("Estilista no encontrada.");

    const phoneNorm = U.normalizePhone(telefono);
    const duplicate = db.appointments.find(
      (a) =>
        U.normalizePhone(a.cliente_telefono) === phoneNorm &&
        a.fecha === payload.fecha &&
        a.hora === payload.hora &&
        !["cancelada", "no_asistio"].includes(a.estado)
    );
    if (duplicate) throw new Error("Ya tienes una cita a esa hora. Revisa “Mis citas”.");

    const client = ensureClient(db, {
      cliente_id: returningClient ? returningClient.id : "",
      cliente_nombre: returningClient ? returningClient.nombre : nombre,
      cliente_telefono: returningClient ? returningClient.telefono : telefono,
      cliente_email: payload.cliente_email || "",
    });

    const appt = {
      id: U.uid("apt"),
      fecha: payload.fecha,
      hora: payload.hora,
      cliente_id: client.id,
      cliente_nombre: client.nombre,
      cliente_telefono: client.telefono,
      servicio_id: svc.id,
      servicio_nombre: svc.nombre,
      estilista_id: estilista.id,
      estilista_nombre: estilista.nombre,
      precio: Number(svc.precio) || 0,
      duracion_min: Number(svc.duracion_min) || 30,
      estado: "pendiente",
      notas: String(payload.notas || "").slice(0, 300),
      creado_en: new Date().toISOString(),
      origen: "web",
    };
    db.appointments.push(appt);
    saveDB(db);
    return { ...publicAppointment(appt), codigo_cliente: client.codigo_cliente };
  }

  function demoLookup(payload) {
    const db = loadDB();
    const client = findDemoClientByCredentials(db, payload);
    const phone = U.normalizePhone(client.telefono);
    const list = db.appointments
      .filter((a) => a.cliente_id === client.id || (!a.cliente_id && U.normalizePhone(a.cliente_telefono) === phone))
      .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))
      .map(publicAppointment);
    return {
      client: { codigo_cliente: client.codigo_cliente, nombre: client.nombre, telefono: client.telefono },
      appointments: list,
    };
  }

  function demoCancel(payload) {
    const db = loadDB();
    const appt = db.appointments.find((a) => a.id === payload.id);
    if (!appt) throw new Error("No encontramos esa cita.");
    const client = findDemoClientByCredentials(db, payload);
    if ((appt.cliente_id && appt.cliente_id !== client.id) || U.normalizePhone(appt.cliente_telefono) !== U.normalizePhone(client.telefono)) throw new Error("La cita no pertenece a este perfil de cliente.");
    if (!["pendiente", "confirmada"].includes(appt.estado)) {
      throw new Error("Esta cita ya no se puede cancelar.");
    }
    const when = `${appt.fecha}T${appt.hora}`;
    const now = `${U.todayISO()}T${U.timeFromMinutes(U.nowMinutes())}`;
    if (when <= now) throw new Error("La cita ya pasó o está en curso.");
    appt.estado = "cancelada";
    saveDB(db);
    return { ok: true };
  }

  function demoAdminData() {
    const db = loadDB();
    return JSON.parse(JSON.stringify(db));
  }

  function demoAdminLogin(payload) {
    if (String(payload.key || "") !== C.admin.demoKey) throw new Error("Clave incorrecta.");
    return { ok: true };
  }

  /* ---------- Acceso de estilistas (demo) ---------- */
  function estilistaFromKey(db, clave) {
    const value = String(clave || "").trim();
    if (!value) throw new Error("Escribe tu clave personal.");
    const estilista = db.estilistas.find(
      (b) => b.activo !== false && String(b.clave || "").trim() === value
    );
    if (!estilista) throw new Error("Clave incorrecta.");
    return estilista;
  }

  function scopedEstilistaData(db, estilista) {
    const since = U.addDays(U.todayISO(), -90);
    const config = db.config || {};
    return {
      version: 1,
      estilista: selfEstilista(estilista),
      services: db.services
        .filter((s) => s.activo !== false)
        .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0)),
      config: {
        nombre_negocio: config.nombre_negocio || C.brand.name,
        moneda: config.moneda || C.currency.code,
        hora_inicio: config.hora_inicio || C.schedule.open,
        hora_fin: config.hora_fin || C.schedule.close,
        dias_cerrados: config.dias_cerrados !== undefined ? config.dias_cerrados : C.schedule.closedDays.join(","),
        slot_minutos: config.slot_minutos || String(C.schedule.slotMinutes),
      },
      appointments: db.appointments.filter(
        (a) => a.estilista_id === estilista.id && a.fecha >= since
      ),
      incomes: db.incomes.filter(
        (i) => i.estilista_id === estilista.id && i.fecha >= since
      ),
      availabilityBlocks: (db.availabilityBlocks || []).filter((x) => x.estilista_id === estilista.id && x.fecha >= U.todayISO()),
    };
  }

  function demoEstilistaLogin(payload) {
    const db = loadDB();
    const estilista = estilistaFromKey(db, payload.clave);
    return { estilista: selfEstilista(estilista), data: scopedEstilistaData(db, estilista) };
  }

  function demoEstilistaData(payload) {
    const db = loadDB();
    const estilista = estilistaFromKey(db, payload.clave);
    return scopedEstilistaData(db, estilista);
  }

  function demoEstilistaSave(payload) {
    const db = loadDB();
    const estilista = estilistaFromKey(db, payload.clave);
    const entity = String(payload.entity || "");
    if (entity !== "appointments" && entity !== "incomes" && entity !== "availabilityBlocks") {
      throw new Error("No puedes modificar esa sección.");
    }
    const record = { ...(payload.record || {}), estilista_id: estilista.id, estilista_nombre: estilista.nombre };

    if (record.id) {
      const list = entity === "appointments" ? db.appointments : entity === "incomes" ? db.incomes : db.availabilityBlocks;
      const existing = list.find((item) => item.id === record.id);
      if (!existing || existing.estilista_id !== estilista.id) throw new Error("Ese registro no es tuyo.");
    }
    return demoAdminSave({ entity, record });
  }

  function demoEstilistaDelete(payload) {
    const db = loadDB();
    const estilista = estilistaFromKey(db, payload.clave);
    const entity = String(payload.entity || "");
    if (entity !== "appointments" && entity !== "incomes" && entity !== "availabilityBlocks") {
      throw new Error("No puedes modificar esa sección.");
    }
    const list = entity === "appointments" ? db.appointments : entity === "incomes" ? db.incomes : db.availabilityBlocks;
    const item = list.find((x) => x.id === payload.id);
    if (!item || item.estilista_id !== estilista.id) throw new Error("Ese registro no es tuyo.");
    return demoAdminDelete({ entity, id: payload.id });
  }

  function demoEstilistaSetStatus(payload) {
    const db = loadDB();
    const estilista = estilistaFromKey(db, payload.clave);
    const appt = db.appointments.find((a) => a.id === payload.id);
    if (!appt || appt.estilista_id !== estilista.id) throw new Error("Esa cita no es tuya.");
    return demoSetStatus(payload);
  }

  function demoAdminSave(payload) {
    const db = loadDB();
    const entity = payload.entity;
    let input = { ...(payload.record || {}) };
    let previous = null;

    if (entity === "config") {
      Object.keys(input).forEach((k) => {
        db.config[k] = String(input[k] ?? "");
      });
      saveDB(db);
      return { config: db.config };
    }

    const lists = {
      services: db.services,
      estilistas: db.estilistas,
      clients: db.clients,
      appointments: db.appointments,
      incomes: db.incomes,
      expenses: db.expenses,
      availabilityBlocks: db.availabilityBlocks || (db.availabilityBlocks = []),
    };
    const list = lists[entity];
    if (!list) throw new Error("Entidad no válida: " + entity);

    // Las actualizaciones parciales (por ejemplo activar/pausar) se mezclan
    // con el registro existente antes de validar.
    if (input.id) {
      const existing = list.find((item) => item.id === input.id);
      if (existing) {
        previous = existing;
        input = { ...existing, ...input };
      }
    }

    if (entity === "appointments") {
      if (!input.fecha || !input.hora) throw new Error("La cita necesita fecha y hora.");
      if (!input.servicio_id) throw new Error("Selecciona un servicio.");
      if (!input.estilista_id) throw new Error("Selecciona una estilista.");
      const svc = db.services.find((s) => s.id === input.servicio_id);
      if (!svc) throw new Error("Servicio no encontrado.");
      const estilista = db.estilistas.find((b) => b.id === input.estilista_id);
      if (!estilista) throw new Error("Estilista no encontrada.");
      if (!input.cliente_telefono) throw new Error("La cita necesita un teléfono.");
      const client = ensureClient(db, input);
      Object.assign(input, {
        cliente_id: client.id,
        cliente_nombre: client.nombre,
        cliente_telefono: client.telefono,
        servicio_nombre: svc.nombre,
        estilista_nombre: estilista.nombre,
        precio: input.precio === "" || input.precio === undefined ? Number(svc.precio) : Number(input.precio),
        duracion_min: Number(input.duracion_min) || Number(svc.duracion_min),
        estado: input.estado || "pendiente",
        origen: input.origen || "admin",
        creado_en: input.creado_en || new Date().toISOString(),
        duracion_real_min: Number(input.duracion_real_min) || 0,
      });
      const scheduleChanged = !previous || previous.fecha !== input.fecha || previous.hora !== input.hora || previous.estilista_id !== input.estilista_id;
      if (scheduleChanged && !["cancelada", "no_asistio"].includes(input.estado)) {
        const start = U.minutesFromTime(input.hora), end = start + input.duracion_min;
        const blocked = (db.availabilityBlocks || []).some((x) => x.estilista_id === input.estilista_id && x.fecha === input.fecha && x.estado !== "Disponible" && start < U.minutesFromTime(x.hora_fin) && end > U.minutesFromTime(x.hora_inicio));
        if (blocked) throw new Error("La estilista no está disponible en ese horario. Elige otra hora o revisa el bloqueo de disponibilidad.");
      }
    }

    if (entity === "availabilityBlocks") {
      input.fecha = String(input.fecha || "");
      input.hora_inicio = String(input.hora_inicio || "");
      input.hora_fin = String(input.hora_fin || "");
      input.estado = String(input.estado || "No disponible");
      if (!input.fecha || U.minutesFromTime(input.hora_inicio) >= U.minutesFromTime(input.hora_fin)) throw new Error("Indica una fecha y un rango horario válido.");
      if (!db.estilistas.some((b) => b.id === input.estilista_id)) throw new Error("Selecciona una estilista válida.");
      if (!["Disponible", "Receso", "Almuerzo", "No disponible"].includes(input.estado)) throw new Error("Estado de disponibilidad inválido.");
      if (input.estado !== "Disponible") {
        const start = U.minutesFromTime(input.hora_inicio), end = U.minutesFromTime(input.hora_fin);
        const conflict = db.appointments.some((a) => a.estilista_id === input.estilista_id && a.fecha === input.fecha && !["cancelada", "no_asistio"].includes(a.estado) && start < U.minutesFromTime(a.hora) + (Number(a.duracion_min) || 30) && end > U.minutesFromTime(a.hora));
        if (conflict) throw new Error("No se puede bloquear ese horario: ya hay una cita asignada. Mueve o cancela la cita antes de crear el bloqueo.");
      }
    }

    if (entity === "clients") {
      if (!String(input.nombre || "").trim()) throw new Error("El cliente necesita un nombre.");
      input.telefono = String(input.telefono || "").trim();
      input.codigo_cliente = input.codigo_cliente || nextClientCode(list);
      input.creado_en = input.creado_en || U.todayISO();
      input.total_citas = Number(input.total_citas) || 0;
      input.total_gastado = Number(input.total_gastado) || 0;
    }

    if (entity === "services") {
      if (!String(input.nombre || "").trim()) throw new Error("El servicio necesita un nombre.");
      input.precio = Number(input.precio) || 0;
      input.duracion_min = Number(input.duracion_min) || 30;
      input.orden = Number(input.orden) || list.length + 1;
      input.activo = input.activo !== false;
    }

    if (entity === "estilistas") {
      if (!String(input.nombre || "").trim()) throw new Error("La estilista necesita un nombre.");
      input.comision_pct = Number(input.comision_pct) || 0;
      input.activo = input.activo !== false;
      if (!input.color) input.color = "#C9A227";
      input.clave = String(input.clave || "").trim();
      if (input.clave) {
        if (input.clave.length < 6) throw new Error("La clave personal debe tener al menos 6 caracteres.");
        const taken = db.estilistas.some(
          (b) => b.id !== input.id && String(b.clave || "").trim() === input.clave
        );
        if (taken) throw new Error("Esa clave ya está en uso por otra estilista.");
      }
    }

    if (entity === "incomes" || entity === "expenses") {
      input.monto = Number(input.monto) || 0;
      if (input.monto <= 0) throw new Error("El monto debe ser mayor a cero.");
      input.fecha = input.fecha || U.todayISO();
      input.categoria = input.categoria || "Otros";
      input.metodo_pago = input.metodo_pago || "Efectivo";
    }

    const prefixes = { services: "srv", estilistas: "brb", clients: "cl", appointments: "apt", incomes: "inc", expenses: "exp", availabilityBlocks: "avl" };
    let record;
    if (input.id) {
      const index = list.findIndex((item) => item.id === input.id);
      if (index === -1) throw new Error("Registro no encontrado.");
      record = { ...list[index], ...input };
      list[index] = record;
    } else {
      record = { ...input, id: U.uid(prefixes[entity] || "reg") };
      list.push(record);
    }

    if (entity === "appointments") {
      recomputeClient(db, record.cliente_id);
      if (previous && previous.cliente_id && previous.cliente_id !== record.cliente_id) {
        recomputeClient(db, previous.cliente_id);
      }
    }
    if (entity === "clients") {
      recomputeClient(db, record.id);
    }

    saveDB(db);
    return record;
  }

  function demoAdminDelete(payload) {
    const db = loadDB();
    const entity = payload.entity;
    if (entity === "config") throw new Error("La configuración no se puede borrar.");
    const list = db[entity];
    if (!list) throw new Error("Entidad no válida.");
    const index = list.findIndex((item) => item.id === payload.id);
    if (index === -1) throw new Error("Registro no encontrado.");
    const [removed] = list.splice(index, 1);
    if (entity === "appointments") {
      db.incomes = db.incomes.filter((i) => i.cita_id !== removed.id);
      recomputeClient(db, removed.cliente_id);
    }
    if (entity === "clients") {
      // conserva las citas históricas, pero sin vínculo activo
      db.appointments.forEach((a) => {
        if (a.cliente_id === removed.id) a.cliente_id = "";
      });
    }
    saveDB(db);
    return { ok: true };
  }

  function demoSetStatus(payload) {
    const db = loadDB();
    const appt = db.appointments.find((a) => a.id === payload.id);
    if (!appt) throw new Error("Cita no encontrada.");
    appt.estado = payload.estado;

    // Datos del cronómetro del servicio.
    if (payload.inicio_en !== undefined) appt.inicio_en = payload.inicio_en;
    if (payload.fin_en !== undefined) appt.fin_en = payload.fin_en;
    if (payload.duracion_real_min !== undefined) appt.duracion_real_min = Number(payload.duracion_real_min) || 0;

    if (payload.estado === "completada") {
      if (!appt.fin_en) appt.fin_en = new Date().toISOString();
      if (!Number(appt.duracion_real_min) && appt.inicio_en) {
        const start = new Date(appt.inicio_en).getTime();
        if (!Number.isNaN(start)) {
          appt.duracion_real_min = Math.max(1, Math.round((Date.now() - start) / 60000));
        }
      }
      let income = db.incomes.find((i) => i.cita_id === appt.id);
      if (!income) {
        income = {
          id: U.uid("inc"),
          fecha: appt.fecha,
          monto: Number(appt.precio) || 0,
          categoria: "Servicio",
          descripcion: `${appt.servicio_nombre} · ${appt.cliente_nombre}`,
          cita_id: appt.id,
          metodo_pago: payload.metodo_pago || "Efectivo",
          estilista_id: appt.estilista_id,
          creado_en: new Date().toISOString(),
        };
        db.incomes.push(income);
      } else {
        income.monto = Number(appt.precio) || income.monto;
        if (payload.metodo_pago) income.metodo_pago = payload.metodo_pago;
      }
    } else {
      db.incomes = db.incomes.filter((i) => i.cita_id !== appt.id);
    }

    recomputeClient(db, appt.cliente_id);
    saveDB(db);
    return { ok: true, appointment: publicAppointment(appt) };
  }

  /* ---------- Cliente HTTP (modo Sheets) ---------- */
  async function request(action, payload = {}) {
    if (DEMO) throw new Error("request() no se usa en modo demo");
    const requestContext = { action, payload };
    window.dispatchEvent(new CustomEvent("sheets:request:start", { detail: requestContext }));
    try {
      const response = await fetch(C.api.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, payload }),
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`Error de conexión (${response.status}). Revisa la URL del Web App.`);
      let json;
      try {
        json = await response.json();
      } catch (e) {
        throw new Error("La respuesta del servidor no es JSON válido. Revisa el despliegue de Apps Script.");
      }
      if (!json || json.ok !== true) throw new Error((json && json.error) || "Error del servidor.");
      return json.data;
    } finally {
      window.dispatchEvent(new CustomEvent("sheets:request:end", { detail: requestContext }));
    }
  }

  function adminPayload(payload = {}) {
    return { ...payload, key: adminKey };
  }

  /* ---------- API pública ---------- */
  const Store = {
    mode: DEMO ? "demo" : "sheets",

    get schedule() {
      return schedule;
    },

    isClosed(iso) {
      return schedule.closedDays.includes(U.parseISO(iso).getDay());
    },

    getAdminKey() {
      return adminKey;
    },

    setAdminKey(key) {
      adminKey = key || "";
      if (adminKey) sessionStorage.setItem(KEY_STORE, adminKey);
      else sessionStorage.removeItem(KEY_STORE);
    },

    async bootstrap() {
      const data = DEMO ? demoBootstrap() : await request("bootstrap");
      schedule = scheduleFrom(data.config || {});
      data.schedule = schedule;
      return data;
    },

    async availability(payload) {
      if (DEMO) return demoAvailability(payload);
      return request("availability", payload);
    },

    async book(payload) {
      if (DEMO) return demoBook(payload);
      return request("book", payload);
    },

    async lookup(identity) {
      if (DEMO) return demoLookup(identity);
      return request("lookup", identity);
    },

    async cancel(id, identity) {
      if (DEMO) return demoCancel({ id, ...identity });
      return request("cancel", { id, ...identity });
    },

    /* ---------- Panel ---------- */
    async adminLogin(key) {
      if (DEMO) return demoAdminLogin({ key });
      const data = await request("adminLogin", { key });
      return data;
    },

    async adminData() {
      const data = DEMO ? demoAdminData() : await request("adminData", adminPayload());
      schedule = scheduleFrom(data.config || {});
      data.schedule = schedule;
      return data;
    },

    async save(entity, record) {
      if (DEMO) return demoAdminSave({ entity, record });
      return request("adminSave", adminPayload({ entity, record }));
    },

    async remove(entity, id) {
      if (DEMO) return demoAdminDelete({ entity, id });
      return request("adminDelete", adminPayload({ entity, id }));
    },

    async setStatus(id, estado, metodo_pago, extra = {}) {
      const payload = { id, estado, metodo_pago, ...extra };
      if (DEMO) return demoSetStatus(payload);
      return request("setStatus", adminPayload(payload));
    },

    /* ---------- Panel de la estilista ---------- */
    async estilistaLogin(clave) {
      if (DEMO) return demoEstilistaLogin({ clave });
      return request("estilistaLogin", { clave });
    },

    async estilistaData(clave) {
      if (DEMO) return demoEstilistaData({ clave });
      return request("estilistaData", { clave });
    },

    async estilistaSave(clave, entity, record) {
      if (DEMO) return demoEstilistaSave({ clave, entity, record });
      return request("estilistaSave", { clave, entity, record });
    },

    async estilistaAvailabilitySave(clave, record) {
      if (DEMO) return demoEstilistaSave({ clave, entity: "availabilityBlocks", record });
      return request("estilistaAvailabilitySave", { clave, record });
    },

    async estilistaAvailabilityDelete(clave, id) {
      if (DEMO) return demoEstilistaDelete({ clave, entity: "availabilityBlocks", id });
      return request("estilistaAvailabilityDelete", { clave, id });
    },

    async estilistaDelete(clave, entity, id) {
      if (DEMO) return demoEstilistaDelete({ clave, entity, id });
      return request("estilistaDelete", { clave, entity, id });
    },

    async estilistaSetStatus(clave, id, estado, metodo_pago, extra = {}) {
      const payload = { clave, id, estado, metodo_pago, ...extra };
      if (DEMO) return demoEstilistaSetStatus(payload);
      return request("estilistaSetStatus", payload);
    },

    resetDemo() {
      if (!DEMO) return;
      localStorage.removeItem(DB_KEY);
      location.reload();
    },
  };

  window.Store = Store;
})();
