(() => {
  const API = window.AGENTICUANTICO_API_URL || "https://agenticweb.agenticuantico.workers.dev";
  const $ = (id) => document.getElementById(id);
  let snapshot = null;
  let plan = null;

  function setStatus(text) {
    if ($("webDesignStatus")) $("webDesignStatus").textContent = text;
  }

  function key() {
    return String($("webBuildKey")?.value || "").trim();
  }

  async function post(path, body) {
    const response = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": key() },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.message || data.error || "La operación no pudo completarse.");
    }
    return data;
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    if (busy) button.dataset.oldLabel = button.textContent;
    button.textContent = busy ? label : (button.dataset.oldLabel || button.textContent);
  }

  function renderSnapshot() {
    if (!snapshot) return;
    const count = snapshot.stats || {};
    $("designerStats").textContent =
      `${snapshot.repo} · ${snapshot.branch} · ${count.files || 0} archivos · ${count.textFiles || 0} textos analizados`;
    $("designerPlanMeta").textContent =
      `base ${String(snapshot.baseSha || "").slice(0, 8)} · ${count.contentChars || 0} caracteres`;
  }

  function renderPlan(data) {
    plan = data.plan;
    $("designerSummary").textContent = plan.summary || "Plan generado.";
    $("designerPlanMeta").textContent =
      `${plan.changes.length} archivos · modelo ${data.model || "Designer"}`;
    $("designerFiles").innerHTML = plan.changes.map((change) => {
      const action = change.action === "create" ? "CREAR" : "MODIFICAR";
      return `<div class="designer-file"><span>${action}</span><b>${escapeHtml(change.path)}</b><small>${escapeHtml(change.reason || "")}</small></div>`;
    }).join("");
    $("designerArchitecture").textContent = (plan.architecture || []).join("\n");
    $("designerTests").textContent = (plan.tests || []).join("\n");
    $("designerChanges").innerHTML = plan.changes.map((change) => `
      <details class="designer-change">
        <summary>${escapeHtml(change.path)} · ${escapeHtml(change.action || "modify")}</summary>
        <pre>${escapeHtml(change.content || "")}</pre>
      </details>`).join("");

    if (plan.preview_html) {
      $("designerPreview").srcdoc = plan.preview_html;
    } else {
      $("designerPreview").srcdoc =
        "<main style='font-family:system-ui;padding:40px;background:#05060d;color:white;min-height:100vh'>Preview no generado.</main>";
    }
    $("designerPublish").disabled = false;
    setStatus("PLAN · listo para revisar");
    $("designerPublishStatus").textContent =
      "Revisá los archivos y la vista previa antes de publicar.";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function scan() {
    const button = $("designerScan");
    if (!key()) {
      setStatus("Falta la clave de administrador");
      $("designerPublishStatus").textContent = "Ingresá la clave de administrador para analizar GitHub.";
      return;
    }
    setBusy(button, true, "Analizando…");
    $("designerPlan").disabled = true;
    $("designerPublish").disabled = true;
    setStatus("SCAN · leyendo repositorio completo…");
    try {
      snapshot = await post("/v1/public/designer/scan", {
        repo: "agenticuantico/AgenticWeb",
        branch: "main"
      });
      plan = null;
      renderSnapshot();
      $("designerPlan").disabled = false;
      $("designerSummary").textContent =
        "Repositorio analizado. Ahora generá el plan multiarchivo.";
      $("designerFiles").innerHTML = "";
      $("designerChanges").innerHTML = "";
      $("designerPreview").srcdoc =
        "<main style='font-family:system-ui;padding:40px;background:#05060d;color:#9fb2cc;min-height:100vh'>Esperando el plan del Designer Agent…</main>";
      setStatus("SCAN · repositorio analizado");
    } catch (error) {
      setStatus("SCAN · error");
      $("designerPublishStatus").textContent = error.message;
    } finally {
      setBusy(button, false);
    }
  }

  async function generatePlan() {
    const button = $("designerPlan");
    const task = String($("webDesignPrompt")?.value || "").trim();
    if (!snapshot) return;
    if (!task) {
      $("designerPublishStatus").textContent = "Describí primero qué querés rediseñar.";
      return;
    }
    setBusy(button, true, "Diseñando…");
    $("designerPublish").disabled = true;
    setStatus("DESIGN · analizando UI/UX + 3D + código…");
    try {
      const data = await post("/v1/public/designer/plan", {
        repo: "agenticuantico/AgenticWeb",
        task,
        snapshot
      });
      renderPlan(data);
    } catch (error) {
      setStatus("DESIGN · error");
      $("designerPublishStatus").textContent = error.message;
    } finally {
      setBusy(button, false);
    }
  }

  async function publish() {
    if (!plan || !snapshot) return;
    if (!confirm("Vas a publicar el plan multiarchivo en main. ¿Continuar?")) return;
    const button = $("designerPublish");
    setBusy(button, true, "Publicando…");
    setStatus("PUBLISH · creando commit atómico…");
    $("designerPublishStatus").textContent = "Verificando que main no haya cambiado…";
    try {
      const data = await post("/v1/public/designer/publish", {
        repo: "agenticuantico/AgenticWeb",
        branch: "main",
        baseSha: snapshot.baseSha,
        plan
      });
      setStatus("PUBLISH · GitHub actualizado");
      $("designerPublishStatus").innerHTML =
        `Publicado · commit <code>${escapeHtml(String(data.commit || "").slice(0, 10))}</code> · ${data.files.length} archivos`;
      $("designerPublish").disabled = true;
      snapshot = null;
      $("designerPlan").disabled = true;
    } catch (error) {
      setStatus("PUBLISH · detenido");
      $("designerPublishStatus").textContent = error.message;
    } finally {
      setBusy(button, false);
      if (!plan) button.disabled = true;
    }
  }

  function wire() {
    $("designerScan")?.addEventListener("click", scan);
    $("designerRefresh")?.addEventListener("click", scan);
    $("designerPlan")?.addEventListener("click", generatePlan);
    $("designerPublish")?.addEventListener("click", publish);

    document.querySelectorAll("[data-design-prompt]").forEach((button) => {
      button.addEventListener("click", () => {
        if ($("webDesignPrompt")) $("webDesignPrompt").value = button.dataset.designPrompt || "";
        if (!snapshot) scan();
      });
    });

    $("openWebStudio")?.addEventListener("click", () => {
      setStatus("Listo · analizá AgenticWeb para comenzar");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire, { once: true });
  } else {
    wire();
  }

  window.AgentiCuanticoDesigner = { scan, generatePlan, publish };
})();