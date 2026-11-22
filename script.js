(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const read = (key, fallback = null) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const write = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));

  const accountDeviceKey = user =>
    `mical_device_${user?.id_cliente || String(user?.email || 'guest').toLowerCase()}`;

  const readAccountDevice = user => read(accountDeviceKey(user));
  const writeAccountDevice = (user, device) => write(accountDeviceKey(user), device);

  const showNotice = (message, type = "error") => {
    const notice = $("#formNotice");
    if (!notice) return;
    notice.textContent = message;
    notice.className = `notice show ${type}`;
  };

  function applyTheme() {
    const dark = localStorage.getItem("mical_theme") === "dark";
    document.body.classList.toggle("theme-dark", dark);

    const buttons = $$('[data-theme-toggle]');

    buttons.forEach(button => {
      const icon = dark ? 'sun' : 'moon';

      if (button.classList.contains('theme-action') || button.closest('.profile-menu')) {
        button.innerHTML = `<i data-lucide="${icon}"></i> Alternar o tema`;
      } else {
        button.innerHTML = `<i data-lucide="${icon}"></i>`;
      }

      button.setAttribute(
        'aria-label',
        dark ? 'Ativar modo claro' : 'Ativar modo escuro'
      );
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function toggleTheme() {
    const dark = document.body.classList.toggle("theme-dark");
    localStorage.setItem("mical_theme", dark ? "dark" : "light");
    applyTheme();
  }

  function firstName(name) {
    const first = String(name || '').trim().split(/\s+/)[0] || 'morador';

    return first.charAt(0).toLocaleUpperCase('pt-BR') +
      first.slice(1).toLocaleLowerCase('pt-BR');
  }

  function renderAuth() {
    const area = $('#authArea');
    if (!area) return;

    const user = read('mical_user');
    const nav = $('.nav-links');

    nav?.querySelector('[data-monitor-nav]')?.remove();

    if (!user) {
      area.innerHTML =
        '<a class="btn btn-secondary" href="cadastro.html">Cadastro</a>' +
        '<a class="btn btn-primary" href="login.html">Login</a>';
      return;
    }

    area.innerHTML = `
      <div class="profile-wrap">
        <button class="theme-toggle" id="profileToggle" aria-label="Abrir perfil" aria-expanded="false">
          <i data-lucide="user-round"></i>
        </button>

        <div class="profile-menu hidden" id="profileMenu">
          <a href="configuracoes.html">
            <i data-lucide="settings"></i> Configurações da conta
          </a>

          <button type="button" data-theme-toggle>
            <i data-lucide="moon"></i> Alternar o tema
          </button>

          <a href="historico.html">
            <i data-lucide="history"></i> Histórico de consumo
          </a>

          <button type="button" id="logoutButton">
            <i data-lucide="log-out"></i> Sair da conta
          </button>
        </div>
      </div>
    `;

    $('#profileToggle')?.addEventListener('click', () => {
      const menu = $('#profileMenu');
      menu.classList.toggle('hidden');

      $('#profileToggle').setAttribute(
        'aria-expanded',
        String(!menu.classList.contains('hidden'))
      );
    });

    $('#logoutButton')?.addEventListener('click', async () => {
      try {
        await fetch('auth.php?action=logout', {
          method: 'POST',
          credentials: 'same-origin'
        });
      } finally {
        localStorage.removeItem('mical_user');
        location.href = 'index.html';
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function setupNavigation() {
    const menuButton = $(".menu-btn");
    const nav = $(".nav-links");

    menuButton?.addEventListener("click", () => {
      const open = nav.classList.toggle("menu-open");

      menuButton.setAttribute("aria-expanded", String(open));

      menuButton.innerHTML = open
        ? '<i data-lucide="x"></i>'
        : '<i data-lucide="menu"></i>';

      if (window.lucide) window.lucide.createIcons();
    });

    nav?.querySelectorAll('a[href*="#"]').forEach(link => {
      link.addEventListener("click", () => {
        nav.classList.remove("menu-open");
        menuButton?.setAttribute("aria-expanded", "false");
      });
    });

    const sections = [...document.querySelectorAll("main section[id]")];

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;

          nav?.querySelectorAll("a").forEach(a => {
            a.classList.toggle(
              "active",
              a.getAttribute("href") === `#${entry.target.id}` ||
              a.getAttribute("href") === `index.html#${entry.target.id}`
            );
          });
        });
      }, { rootMargin: "-35% 0px -55% 0px" });

      sections.forEach(section => observer.observe(section));
    }
  }

  function cpfValid(cpf) {
    cpf = String(cpf || "").replace(/\D/g, "");

    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;

    for (let i = 0; i < 9; i++) {
      sum += Number(cpf[i]) * (10 - i);
    }

    let first = (sum * 10) % 11;
    if (first === 10) first = 0;
    if (first !== Number(cpf[9])) return false;

    sum = 0;

    for (let i = 0; i < 10; i++) {
      sum += Number(cpf[i]) * (11 - i);
    }

    let second = (sum * 10) % 11;
    if (second === 10) second = 0;

    return second === Number(cpf[10]);
  }

  function setupPasswordControls() {
    $$('[data-password-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const input = $('#' + button.dataset.passwordToggle);
        if (!input) return;

        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';

        button.innerHTML = visible
          ? '<i data-lucide="eye-off"></i>'
          : '<i data-lucide="eye"></i>';

        button.setAttribute(
          'aria-label',
          visible ? 'Ocultar senha' : 'Mostrar senha'
        );

        if (window.lucide) window.lucide.createIcons();
      });
    });
  }

  function passwordChecks(value) {
    return {
      upper: /[A-Z]/.test(value),
      lower: /[a-z]/.test(value),
      number: /[0-9]/.test(value),
      special: /[^A-Za-z0-9]/.test(value)
    };
  }

  function setupRegister() {
    const form = $('#registerForm');
    if (!form) return;

    const pass = $('#senha');
    const confirm = $('#senhaConfirm');
    const email = $('#email');
    const emailConfirm = $('#emailConfirm');

    const rules = () => {
      const checks = passwordChecks(pass.value);

      Object.entries(checks).forEach(([key, valid]) => {
        $(`[data-rule="${key}"]`)?.classList.toggle('valid', valid);
      });
    };

    const matches = () => {
      const emailMessage = $('#emailMatch');
      const passwordMessage = $('#passwordMatch');

      if (emailConfirm.value) {
        const valid =
          email.value.trim().toLowerCase() ===
          emailConfirm.value.trim().toLowerCase();

        emailMessage.textContent = valid
          ? 'Os e-mails coincidem'
          : 'Os e-mails ainda não estão iguais';

        emailMessage.className =
          'validation-message ' + (valid ? 'valid' : 'invalid');
      } else {
        emailMessage.textContent = '';
      }

      if (confirm.value) {
        const valid = pass.value === confirm.value;

        passwordMessage.textContent = valid
          ? 'As senhas coincidem'
          : 'As senhas ainda não estão iguais';

        passwordMessage.className =
          'validation-message ' + (valid ? 'valid' : 'invalid');
      } else {
        passwordMessage.textContent = '';
      }
    };

    pass.addEventListener('input', () => {
      rules();
      matches();
    });

    confirm.addEventListener('input', matches);
    email.addEventListener('input', matches);
    emailConfirm.addEventListener('input', matches);

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const data = Object.fromEntries(new FormData(form).entries());
      const name = String(data.nome || '').trim();
      const mail = String(data.email || '').trim().toLowerCase();
      const phone = String(data.telefone || '').trim();
      const birth = String(data.nascimento || '');

      if (!name || !/^[\p{L}][\p{L}\s'-]+$/u.test(name)) {
        return showNotice('Informe um nome completo válido.');
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        return showNotice('Informe um endereço de e-mail válido.');
      }

      if (mail !== String(data.emailConfirm || '').trim().toLowerCase()) {
        return showNotice('Os e-mails informados não coincidem.');
      }

      if (!birth) {
        return showNotice('Informe sua data de nascimento.');
      }

      const date = new Date(birth + 'T00:00:00');
      const now = new Date();

      let age = now.getFullYear() - date.getFullYear();

      if (
        now.getMonth() < date.getMonth() ||
        (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())
      ) {
        age--;
      }

      if (Number.isNaN(date.getTime()) || date > now) {
        return showNotice('Informe uma data de nascimento válida.');
      }

      if (age < 18) {
        return showNotice(
          'Não é possível concluir o cadastro. O MICAL permite contas somente para maiores de 18 anos.'
        );
      }

      const digits = phone.replace(/\D/g, '');

      if (
        !/^[\d()+\-\s]{10,20}$/.test(phone) ||
        digits.length < 10 ||
        digits.length > 11
      ) {
        return showNotice('Informe um telefone válido com DDD.');
      }

      if (!Object.values(passwordChecks(String(data.senha || ''))).every(Boolean)) {
        return showNotice(
          'A senha deve conter letra maiúscula, letra minúscula, número e caractere especial.'
        );
      }

      if (data.senha !== data.senhaConfirm) {
        return showNotice('As senhas informadas não coincidem.');
      }

      if (!data.acceptTerms) {
        return showNotice(
          'É necessário aceitar a Política de Privacidade e os Termos de Uso.'
        );
      }

      const button = form.querySelector('[type="submit"]');
      button.disabled = true;

      try {
        const response = await fetch('auth.php?action=register', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: name,
            email: mail,
            telefone: phone,
            nascimento: birth,
            senha: data.senha,
            acceptTerms: true
          })
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(
            result.message || 'Não foi possível realizar o cadastro.'
          );
        }

        write('mical_user', result.user);

        showNotice(
          'Cadastro realizado com sucesso! Redirecionando para o primeiro acesso.',
          'success'
        );

        setTimeout(() => {
          location.href = 'primeiro-acesso.html';
        }, 700);

      } catch (error) {
        showNotice(
          error.message || 'Não foi possível conectar ao servidor. Tente novamente.'
        );
      } finally {
        button.disabled = false;
      }
    });
  }

  function setupLogin() {
    const form = $("#loginForm");
    if (!form) return;

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const email = $("#loginEmail").value.trim();
      const senha = $("#loginPassword").value;

      const button = form.querySelector('[type="submit"]');
      button.disabled = true;

      try {
        const response = await fetch('auth.php?action=login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, senha })
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.message || 'E-mail ou senha incorretos.');
        }

        write('mical_user', result.user);

        location.href = readAccountDevice(result.user)
          ? "monitoramento.html"
          : "primeiro-acesso.html";

      } catch (error) {
        showNotice(
          error.message || 'Não foi possível conectar ao servidor. Tente novamente.'
        );
      } finally {
        button.disabled = false;
      }
    });

    $("#forgotButton")?.addEventListener("click", () => {
      showNotice("A recuperação de senha ainda não está disponível nesta versão.");
    });
  }

  function setupSettings() {
    const form = $('#settingsForm');
    if (!form) return;

    const user = read('mical_user');

    if (!user) {
      location.href = 'login.html';
      return;
    }

    ['nome', 'email', 'telefone', 'nascimento'].forEach(key => {
      const element = $('#' + key);
      if (element) element.value = user[key] || '';
    });

    form.addEventListener('submit', event => {
      event.preventDefault();

      const updated = { ...user };

      ['nome', 'email', 'telefone', 'nascimento'].forEach(key => {
        updated[key] = $('#' + key).value.trim();
      });

      const users = read('mical_users', []);
      const index = users.findIndex(
        item => item.id_cliente === user.id_cliente
      );

      if (index >= 0) {
        users[index] = { ...users[index], ...updated };
        write('mical_users', users);
      }

      write('mical_user', updated);

      showNotice(
        'Informações atualizadas neste navegador.',
        'success'
      );
    });
  }

  function setupFirstAccess() {
    const root = $("#firstAccess");
    if (!root) return;

    if (!read("mical_user")) {
      location.href = "login.html";
      return;
    }

    const draft = read("mical_device_draft", {});
    let step = Number(draft.step) || 1;

    const state = {
      tipo: draft.tipo || "",
      codigo: draft.codigo || "",
      moradores: draft.moradores || "",
      horario: draft.horario || "",
      valorAgua: draft.valorAgua || "",
      consumoAgua: draft.consumoAgua || "",
      referenciaAgua: draft.referenciaAgua || "",
      valorEnergia: draft.valorEnergia || "",
      consumoEnergia: draft.consumoEnergia || "",
      referenciaEnergia: draft.referenciaEnergia || ""
    };

    const labels = {
      agua: "Monitoramento de água",
      energia: "Monitoramento de energia",
      ambos: "Monitoramento completo"
    };

    const sensors = {
      agua: "Sensor YF-S201",
      energia: "Sensor SCT-013",
      ambos: "Sensores YF-S201 e SCT-013"
    };

    const isWater = () =>
      state.tipo === "agua" || state.tipo === "ambos";

    const isEnergy = () =>
      state.tipo === "energia" || state.tipo === "ambos";

    const persist = () =>
      write("mical_device_draft", { ...state, step });

    const notice = message => {
      const element = $("#wizardNotice");
      element.textContent = message;
      element.classList.add("show", "error");
    };

    const clearNotice = () => {
      const element = $("#wizardNotice");
      element.textContent = "";
      element.className = "notice";
    };

    const renderProgress = () => {
      [1, 2, 3].forEach(number => {
        const element = $(`[data-progress="${number}"]`);

        element.className =
          "progress-step" +
          (number === step ? " active" : number < step ? " done" : "");

        element.querySelector(".number").textContent =
          number < step ? "✓" : number;
      });
    };

    const fillForm = () => {
      Object.keys(state)
        .filter(key => key !== "tipo")
        .forEach(key => {
          const element = $(`[name="${key}"]`);
          if (element) element.value = state[key];
        });

      $$("input[name='tipo']").forEach(element => {
        element.checked = element.value === state.tipo;

        element.closest(".choice-card")
          .classList.toggle("selected", element.checked);
      });

      $("#usageQuestion").textContent =
        state.tipo === "agua"
          ? "Qual é a faixa de horário de uso da água na residência?"
          : state.tipo === "energia"
            ? "Qual é a faixa de horário de uso de energia elétrica na residência?"
            : "Qual é a faixa de horário de uso da água e da energia elétrica na residência?";

      $("#usageInput").placeholder =
        state.tipo === "agua"
          ? "Ex.: Das 7h às 22h"
          : state.tipo === "energia"
            ? "Ex.: Das 6h às 23h"
            : "Ex.: Água das 7h às 22h e energia das 6h às 23h";

      $("#waterFields").classList.toggle("hidden", !isWater());
      $("#energyFields").classList.toggle("hidden", !isEnergy());

      ["valorAgua", "consumoAgua", "referenciaAgua"].forEach(key => {
        const element = $(`[name="${key}"]`);
        if (element) element.required = isWater();
      });

      ["valorEnergia", "consumoEnergia", "referenciaEnergia"].forEach(key => {
        const element = $(`[name="${key}"]`);
        if (element) element.required = isEnergy();
      });
    };

    const escapeHTML = value =>
      String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character]));

    const updateSummary = () => {
      const rows = [
        ["Tipo de monitoramento", labels[state.tipo]],
        ["Código informado", state.codigo],
        ["Sensores", sensors[state.tipo]],
        ["Moradores", `${state.moradores} pessoa(s)`],
        ["Horários de utilização", state.horario]
      ];

      if (isWater()) {
        rows.push(
          ["Conta de água", `R$ ${Number(state.valorAgua).toFixed(2).replace(".", ",")}`],
          ["Consumo de água", `${state.consumoAgua} m³`],
          [
            "Referência da conta de água",
            state.referenciaAgua
              ? state.referenciaAgua.split("-").reverse().join("/")
              : ""
          ]
        );
      }

      if (isEnergy()) {
        rows.push(
          ["Conta de energia", `R$ ${Number(state.valorEnergia).toFixed(2).replace(".", ",")}`],
          ["Consumo de energia", `${state.consumoEnergia} kWh`],
          [
            "Referência da conta de energia",
            state.referenciaEnergia
              ? state.referenciaEnergia.split("-").reverse().join("/")
              : ""
          ]
        );
      }

      $("#summaryContent").innerHTML = rows
        .map(([label, value]) =>
          `<div class="summary-item"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong></div>`
        )
        .join("");
    };

    const showStep = () => {
      clearNotice();
      renderProgress();

      $$(".wizard-panel[data-step-panel]").forEach(panel => {
        panel.classList.toggle(
          "hidden",
          Number(panel.dataset.stepPanel) !== step
        );
      });

      if (step === 2) fillForm();
      if (step === 3) updateSummary();

      persist();
    };

    $$("input[name='tipo']").forEach(element => {
      element.addEventListener("change", () => {
        state.tipo = element.value;

        $$(".choice-card").forEach(card => {
          card.classList.toggle(
            "selected",
            card.querySelector("input").checked
          );
        });

        $("#continueDevice").disabled = false;
        persist();
      });
    });

    $("#continueDevice").addEventListener("click", () => {
      if (!state.tipo) {
        return notice("Selecione uma opção de monitoramento para continuar.");
      }

      const code = $("#deviceCode").value.trim();

      if (!code) {
        return notice("Informe o código de identificação do aparelho.");
      }

      state.codigo = code;
      step = 2;
      showStep();
    });

    $("#backToDevice").addEventListener("click", () => {
      state.codigo = $("#deviceCode").value.trim() || state.codigo;
      step = 1;
      showStep();
      $("#deviceCode").value = state.codigo;
    });

    $("#continueQuestionnaire").addEventListener("click", () => {
      clearNotice();

      [
        "moradores",
        "horario",
        ...(isWater()
          ? ["valorAgua", "consumoAgua", "referenciaAgua"]
          : []),
        ...(isEnergy()
          ? ["valorEnergia", "consumoEnergia", "referenciaEnergia"]
          : [])
      ].forEach(key => {
        const element = $(`[name="${key}"]`);
        state[key] = element ? element.value.trim() : "";
      });

      const people = Number(state.moradores);

      if (!Number.isInteger(people) || people < 1) {
        return notice(
          "Informe uma quantidade válida de moradores (número inteiro maior que zero)."
        );
      }

      if (!state.horario) {
        return notice("Informe a faixa de horário de utilização.");
      }

      for (const key of [
        "valorAgua",
        "consumoAgua",
        "valorEnergia",
        "consumoEnergia"
      ]) {
        if (
          (key.endsWith("Agua") && isWater()) ||
          (key.endsWith("Energia") && isEnergy())
        ) {
          if (
            state[key] === "" ||
            !Number.isFinite(Number(state[key])) ||
            Number(state[key]) < 0
          ) {
            return notice(
              "Preencha os valores das contas e dos consumos com números iguais ou maiores que zero."
            );
          }
        }
      }

      if (
        isWater() &&
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(state.referenciaAgua)
      ) {
        return notice(
          "Informe o mês e o ano de referência da conta de água."
        );
      }

      if (
        isEnergy() &&
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(state.referenciaEnergia)
      ) {
        return notice(
          "Informe o mês e o ano de referência da conta de energia."
        );
      }

      step = 3;
      showStep();
    });

    $("#backToQuestionnaire").addEventListener("click", () => {
      [
        "moradores",
        "horario",
        "valorAgua",
        "consumoAgua",
        "referenciaAgua",
        "valorEnergia",
        "consumoEnergia",
        "referenciaEnergia"
      ].forEach(key => {
        const element = $(`[name="${key}"]`);
        if (element) state[key] = element.value.trim();
      });

      step = 2;
      showStep();
    });

    // Envia os dados do aparelho e das contas para o MySQL.
    $("#confirmDevice").addEventListener("click", async () => {
      const user = read("mical_user", {});
      const button = $("#confirmDevice");

      button.disabled = true;

      try {
        const response = await fetch("salvar-aparelho.php", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(state)
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(
            result.message || "Não foi possível salvar os dados."
          );
        }

        writeAccountDevice(user, {
          ...state,
          aparelho_id: result.aparelho_id,
          token: result.token,
          labels: {
            tipo: labels[state.tipo],
            sensores: sensors[state.tipo]
          },
          registeredAt: new Date().toISOString(),
          connected: false
        });

        localStorage.removeItem("mical_device_draft");

        $("#successName").textContent =
          user.nome ? `, ${firstName(user.nome)}` : "";

        step = 4;

        $$('.wizard-panel[data-step-panel]').forEach(panel => {
          panel.classList.add("hidden");
        });

        $("#successPanel").classList.remove("hidden");
        $("#progressArea").classList.add("hidden");

      } catch (error) {
        notice(
          error.message ||
          "Não foi possível conectar ao servidor. Tente novamente."
        );
      } finally {
        button.disabled = false;
      }
    });

    $("#goToMonitoring").addEventListener("click", () => {
      location.href = "monitoramento.html";
    });

    $("#deviceCode").value = state.codigo;

    if (state.tipo) {
      $("#continueDevice").disabled = false;

      $$("input[name='tipo']").forEach(element => {
        element.checked = element.value === state.tipo;

        element.closest(".choice-card")
          .classList.toggle("selected", element.checked);
      });
    }

    if (step === 2 || step === 3) {
      step = 1;
      showStep();
    } else {
      showStep();
    }
  }

  function setupStart() {
    const button = $("#startNow");
    if (!button) return;

    button.addEventListener("click", event => {
      event.preventDefault();

      const user = read("mical_user");

      if (!user) {
        location.href = "login.html";
        return;
      }

      location.href = readAccountDevice(user)
        ? "monitoramento.html"
        : "primeiro-acesso.html";
    });
  }

  const supabaseConfig = () => window.MICAL_SUPABASE || {};

  function formatNumber(value, decimals = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("pt-BR");
  }

  function getDeviceId(device) {
    return Number(device?.aparelho_id || device?.id || 0);
  }

  async function fetchMeasurements(deviceId, limit = 100, origin = null) {
    const config = supabaseConfig();
    if (!config.url || config.url.includes("COLE_AQUI") ||
        !config.publishableKey || config.publishableKey.includes("COLE_AQUI")) {
      throw new Error("Configure a URL do projeto e a Publishable key no arquivo supabase-config.js.");
    }

    const baseUrl = config.url.replace(/\/+$/, "");
    const url = new URL(`${baseUrl}/rest/v1/${config.table || "medicoes"}`);
    url.searchParams.set("select", "id,aparelho_id,consumo_agua_litros,consumo_energia_kwh,corrente_a,vazao_l_min,potencia_w,agua_total_litros,energia_total_kwh,medido_em,origem");
    url.searchParams.set("aparelho_id", `eq.${deviceId}`);
      if (origin) {
  		url.searchParams.set("origem", `eq.${origin}`);
	  }
    url.searchParams.set("order", "medido_em.desc");
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "apikey": config.publishableKey,
        "Authorization": `Bearer ${config.publishableKey}`,
        "Accept": "application/json"
      },
      cache: "no-store"
    });

    const body = await response.text();
    if (!response.ok) {
      let message = body;
      try {
        const parsed = JSON.parse(body);
        message = parsed.message || parsed.error_description || body;
      } catch (_) {}
      throw new Error(`Supabase (${response.status}): ${message}`);
    }

    try {
      return JSON.parse(body);
    } catch (_) {
      throw new Error("O Supabase retornou uma resposta inesperada.");
    }
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function renderLatestMeasurement(measurement) {
    if (!measurement) {
      setText("measurementUpdated", "Nenhuma medição recebida ainda.");
      return;
    }

    setText("waterFlowValue", `${formatNumber(measurement.vazao_l_min)} L/min`);
    setText("waterTotalValue", `${formatNumber(measurement.agua_total_litros)} L`);
    setText("waterIntervalValue", `${formatNumber(measurement.consumo_agua_litros)} L`);
    setText("energyCurrentValue", `${formatNumber(measurement.corrente_a, 3)} A`);
    setText("energyPowerValue", `${formatNumber(measurement.potencia_w)} W`);
    setText("energyTotalValue", `${formatNumber(measurement.energia_total_kwh, 6)} kWh`);
    setText("measurementUpdated", `Última atualização: ${formatDate(measurement.medido_em)}`);
    setText("deviceStatus", "Conectado: recebendo medições do ESP32.");
    const pill = document.getElementById("deviceStatusPill");
    if (pill) {
      pill.textContent = "Recebendo dados";
      pill.classList.add("status-online");
    }
  }

// =====================================
// GRÁFICOS COMPARATIVOS DO MICAL
// =====================================

// Busca as medições reais enviadas pelo ESP32 para o aparelho selecionado.
async function fetchDashboardMeasurements(deviceId) {
    return await fetchMeasurements(deviceId, 1000, "esp32");
}


// Converte uma data para o formato AAAA-MM-DD.
function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// Soma exclusivamente as medições reais recebidas do ESP32.
function calculatePeriod(rows, start, end) {
    const result = { agua_real: 0, energia_real: 0, registros: 0 };
    rows.forEach(row => {
        if (!row.medido_em) return;
        const date = new Date(row.medido_em);
        if (Number.isNaN(date.getTime()) || date < start || date >= end) return;
        result.agua_real += Number(row.consumo_agua_litros) || 0;
        result.energia_real += Number(row.consumo_energia_kwh) || 0;
        result.registros += 1;
    });
    return result;
}

// Cria gráfico comparativo usando somente medições reais.
function renderComparisonChart(elementId, currentLabel, previousLabel, current, previous, resource) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const isWater = resource === "agua";
    const unit = isWater ? "L" : "kWh";
    const currentValue = isWater ? current.agua_real : current.energia_real;
    const previousValue = isWater ? previous.agua_real : previous.energia_real;
    if (!current.registros && !previous.registros) {
        element.innerHTML = '<p class="chart-empty">Ainda não há medições reais suficientes para comparar estes períodos.</p>';
        return;
    }
    const maximum = Math.max(currentValue, previousValue, 0.01);
    const currentHeight = currentValue > 0 ? Math.max(2, currentValue / maximum * 100) : 0;
    const previousHeight = previousValue > 0 ? Math.max(2, previousValue / maximum * 100) : 0;
    element.innerHTML = `
      <div class="compare-chart"><div class="chart-bars">
        <div class="chart-column"><span class="chart-value">${formatNumber(currentValue)} ${unit}</span>
          <div class="chart-bar-area"><div class="chart-bar-stack ${resource}" style="height:${currentHeight}%"><div class="chart-bar-real" style="height:100%"></div></div></div>
          <span class="chart-label">${currentLabel}</span></div>
        <div class="chart-column"><span class="chart-value">${formatNumber(previousValue)} ${unit}</span>
          <div class="chart-bar-area"><div class="chart-bar-stack ${resource}" style="height:${previousHeight}%"><div class="chart-bar-real" style="height:100%"></div></div></div>
          <span class="chart-label">${previousLabel}</span></div>
      </div></div>`;
}

// Atualiza os gráficos de água e/ou energia conforme o cadastro do aparelho.
function renderDashboardCharts(rows, device) {
    const hasWater = device.tipo === "agua" || device.tipo === "ambos";
    const hasEnergy = device.tipo === "energia" || device.tipo === "ambos";
    document.getElementById("waterCharts")?.classList.toggle("hidden", !hasWater);
    document.getElementById("energyCharts")?.classList.toggle("hidden", !hasEnergy);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const today = calculatePeriod(rows, todayStart, tomorrowStart);
    const yesterday = calculatePeriod(rows, yesterdayStart, todayStart);
    const weekStart = new Date(todayStart);
    const difference = weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1;
    weekStart.setDate(weekStart.getDate() - difference);
    const previousWeekStart = new Date(weekStart); previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const nextWeekStart = new Date(weekStart); nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const thisWeek = calculatePeriod(rows, weekStart, nextWeekStart);
    const lastWeek = calculatePeriod(rows, previousWeekStart, weekStart);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const thisMonth = calculatePeriod(rows, monthStart, nextMonthStart);
    const lastMonth = calculatePeriod(rows, previousMonthStart, monthStart);
    if (hasWater) {
      renderComparisonChart("waterDailyChart", "Hoje", "Ontem", today, yesterday, "agua");
      renderComparisonChart("waterWeeklyChart", "Esta semana", "Semana passada", thisWeek, lastWeek, "agua");
      renderComparisonChart("waterMonthlyChart", "Este mês", "Mês passado", thisMonth, lastMonth, "agua");
    }
    if (hasEnergy) {
      renderComparisonChart("energyDailyChart", "Hoje", "Ontem", today, yesterday, "energia");
      renderComparisonChart("energyWeeklyChart", "Esta semana", "Semana passada", thisWeek, lastWeek, "energia");
      renderComparisonChart("energyMonthlyChart", "Este mês", "Mês passado", thisMonth, lastMonth, "energia");
    }
}

// =====================================
// DASHBOARD DO MICAL
// =====================================

function setupDashboard() {
    const root = $("#dashboardRoot");

    if (!root) return;

    const user = read("mical_user");
    const device = readAccountDevice(user);

    if (!user) {
        $("#guestDashboard")?.classList.remove("hidden");
        return;
    }

    if (!device) {
        $("#noDeviceDashboard")?.classList.remove("hidden");
        return;
    }

    $("#activeDashboard")?.classList.remove("hidden");

    $("#welcomeName").textContent = firstName(user.nome);
    $("#deviceId").textContent = device.codigo || "—";

    $("#deviceType").textContent =
        device.labels?.tipo || device.tipo || "Monitoramento residencial";

    const hasWater =
        device.tipo === "agua" || device.tipo === "ambos";

    const hasEnergy =
        device.tipo === "energia" || device.tipo === "ambos";

    $("#waterCard")?.classList.toggle("hidden", !hasWater);
    $("#energyCard")?.classList.toggle("hidden", !hasEnergy);

    $("#waterCharts")?.classList.toggle("hidden", !hasWater);
    $("#energyCharts")?.classList.toggle("hidden", !hasEnergy);

    const id = getDeviceId(device);

    if (!id) {
        setText(
            "deviceStatus",
            "Não foi possível identificar o aparelho cadastrado."
        );

        return;
    }


    // Atualiza os valores das medições reais.
    const updateLatest = async () => {
        try {
            const measurements = await fetchDashboardMeasurements(id);

            const latestReal = measurements
                .filter(row => row.origem !== "demonstrativo")
                .sort((a, b) =>
                    new Date(b.medido_em) - new Date(a.medido_em)
                )[0];

            renderLatestMeasurement(latestReal || null);

        } catch (error) {
            setText("deviceStatus", error.message);

            setText(
                "measurementUpdated",
                "Não foi possível atualizar as medições."
            );
        }
    };


    // Atualiza os gráficos com os dados reais e demonstrativos.
    const updateCharts = async () => {
        try {
            const measurements = await fetchDashboardMeasurements(id);

            renderDashboardCharts(measurements, device);

        } catch (error) {
            console.error(error);

            setText(
                "waterDailyChart",
                "Não foi possível carregar os gráficos."
            );

            setText(
                "energyDailyChart",
                "Não foi possível carregar os gráficos."
            );
        }
    };


    updateLatest();
    updateCharts();

    // Atualização das medições a cada 1 segundos.
    window.setInterval(updateLatest, 1000);

    // Atualização dos gráficos a cada 60 segundos.
    window.setInterval(updateCharts, 60000);
}

  function setupHistory() {
    const root = $("#historyRoot");
    if (!root) return;

    const user = read("mical_user");
    if (!user) {
      $("#historyGuest")?.classList.remove("hidden");
      $("#historyContent")?.classList.add("hidden");
      return;
    }

    $("#historyOwner").textContent = firstName(user.nome);
    const device = readAccountDevice(user);
    const deviceId = getDeviceId(device);

    if (!device || !deviceId) {
      $("#historyDeviceNote")?.classList.remove("hidden");
      $("#historyTableWrap")?.classList.add("hidden");
      return;
    }

    $("#historyDeviceNote")?.classList.add("hidden");
    const resourceSelect = $("#historyResource");
    const periodSelect = $("#historyPeriod");
    const tbody = $("#historyRows");
    const status = $("#historyStatus");

    const renderRows = rows => {
      if (!tbody) return;
      const resource = resourceSelect?.value || "all";
      const filtered = rows.filter(row => {
        if (resource === "agua") return true; // água é exibida na coluna própria
        if (resource === "energia") return true; // energia é exibida na coluna própria
        return true;
      });

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="5">Nenhuma medição encontrada para este período.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(row => `
        <tr>
          <td>${formatDate(row.medido_em)}</td>
          <td>${formatNumber(row.consumo_agua_litros)} L</td>
          <td>${formatNumber(row.vazao_l_min)} L/min</td>
          <td>${formatNumber(row.consumo_energia_kwh, 6)} kWh</td>
          <td>${formatNumber(row.corrente_a, 3)} A</td>
        </tr>
      `).join("");
    };

    const loadHistory = async () => {
      try {
        if (status) status.textContent = "Carregando medições...";
        const period = periodSelect?.value || "24h";
        const now = new Date();
        let since = new Date(0);
        if (period === "24h") since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        if (period === "7d") since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (period === "30d") since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const rows = await fetchMeasurements(deviceId, 500);
        const filtered = period === "custom"
          ? rows
          : rows.filter(row => row.medido_em && new Date(row.medido_em) >= since);

        renderRows(filtered);
        if (status) status.textContent = `${filtered.length} registro(s) encontrado(s).`;
        $("#historyEmpty")?.classList.toggle("hidden", filtered.length > 0);
        $("#historyTableWrap")?.classList.toggle("hidden", filtered.length === 0);
      } catch (error) {
        if (status) status.textContent = error.message;
      }
    };

    resourceSelect?.addEventListener("change", loadHistory);
    periodSelect?.addEventListener("change", loadHistory);
    loadHistory();
  }

  async function setupBillCalculator() {
    const status = $("#billStatus");
    if (!status) return;
    const user = read("mical_user");
    if (!user) { $("#billGuest")?.classList.remove("hidden"); status.classList.add("hidden"); return; }
    const device = readAccountDevice(user);
    const deviceId = getDeviceId(device);
    if (!device || !deviceId) { $("#billNoDevice")?.classList.remove("hidden"); status.classList.add("hidden"); return; }
    try {
      status.textContent = "Consultando suas contas cadastradas e as últimas medições...";
      const [billResponse, measurements] = await Promise.all([
        fetch(`obter-contas.php?aparelho_id=${encodeURIComponent(deviceId)}`, { credentials: "same-origin", cache: "no-store" }),
        fetchDashboardMeasurements(deviceId)
      ]);
      const billData = await billResponse.json();
      if (!billResponse.ok || !billData.ok) throw new Error(billData.message || "Não foi possível consultar as contas.");
      const latest = measurements
        .filter(row => row.origem === "esp32" || row.origem === "real")
        .sort((a, b) => new Date(b.medido_em) - new Date(a.medido_em))[0];
      if (!latest) throw new Error("Ainda não foram encontradas medições reais do ESP32 para este aparelho.");
      const bills = billData.contas || [];
      const money = value => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const getBill = resource => bills.find(item => item.recurso === resource && Number(item.consumo) > 0);
      if (device.tipo === "agua" || device.tipo === "ambos") {
        $("#waterEstimate")?.classList.remove("hidden");
        const bill = getBill("agua");
        if (bill) {
          const m3 = (Number(latest.agua_total_litros) || 0) / 1000;
          const unit = Number(bill.valor_pago) / Number(bill.consumo);
          $("#waterEstimateConsumption").textContent = `${formatNumber(m3, 3)} m³ (${formatNumber(m3 * 1000)} L)`;
          $("#waterUnitPrice").textContent = `${money(unit)} por m³`;
          $("#waterEstimateValue").textContent = money(m3 * unit);
          $("#waterBillReference").textContent = `Base: conta cadastrada de ${new Date(`${bill.referencia}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.`;
        } else {
          $("#waterEstimateValue").textContent = "Conta anterior indisponível";
          $("#waterEstimateConsumption").textContent = `${formatNumber((Number(latest.agua_total_litros)||0)/1000, 3)} m³`;
          $("#waterUnitPrice").textContent = "Cadastre uma conta de água com consumo maior que zero.";
        }
      }
      if (device.tipo === "energia" || device.tipo === "ambos") {
        $("#energyEstimate")?.classList.remove("hidden");
        const bill = getBill("energia");
        if (bill) {
          const kwh = Number(latest.energia_total_kwh) || 0;
          const unit = Number(bill.valor_pago) / Number(bill.consumo);
          $("#energyEstimateConsumption").textContent = `${formatNumber(kwh, 4)} kWh`;
          $("#energyUnitPrice").textContent = `${money(unit)} por kWh`;
          $("#energyEstimateValue").textContent = money(kwh * unit);
          $("#energyBillReference").textContent = `Base: conta cadastrada de ${new Date(`${bill.referencia}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.`;
        } else {
          $("#energyEstimateValue").textContent = "Conta anterior indisponível";
          $("#energyEstimateConsumption").textContent = `${formatNumber(Number(latest.energia_total_kwh)||0, 4)} kWh`;
          $("#energyUnitPrice").textContent = "Cadastre uma conta de energia com consumo maior que zero.";
        }
      }
      status.textContent = `Estimativa atualizada com a última leitura recebida em ${formatDate(latest.medido_em)}.`;
    } catch (error) { status.textContent = error.message; }
  }

  function setupEconomyTips() {
    if (!$("#waterTips") && !$("#energyTips")) return;

    // Visitantes e usuários sem aparelho cadastrado podem consultar todas as dicas.
    const user = read("mical_user");
    if (!user) return;

    const device = readAccountDevice(user);
    if (!device) return;

    const tipo = String(device.tipo || "").toLowerCase();
    const hasWater = tipo === "agua" || tipo === "ambos";
    const hasEnergy = tipo === "energia" || tipo === "ambos";
    $("#waterTips")?.classList.toggle("hidden", !hasWater);
    $("#energyTips")?.classList.toggle("hidden", !hasEnergy);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderAuth();
    applyTheme();
    setupNavigation();

    document.addEventListener("click", event => {
      if (event.target.closest("[data-theme-toggle]")) {
        toggleTheme();
      }
    });

    setupPasswordControls();
    setupRegister();
    setupLogin();
    setupSettings();
    setupFirstAccess();
    setupDashboard();
    setupStart();
    setupHistory();
    setupBillCalculator();
    setupEconomyTips();

    if (window.lucide) window.lucide.createIcons();
  });

  window.MICAL_API = {
    async request(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
      });
      if (!response.ok) throw new Error(`Falha na API (${response.status})`);
      return response.status === 204 ? null : response.json();
    }
  };
})();
