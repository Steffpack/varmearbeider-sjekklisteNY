// === Konfigurasjon ===
const supabaseUrl = "https://sjgmpljxitppkqkzdfvf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZ21wbGp4aXRwcGtxa3pkZnZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MTY3NTYsImV4cCI6MjA2Nzk5Mjc1Nn0.SsO3nJ4IfV9BNGD4WNgA5MrrRTv58xAc2xtWWJWP2HU";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// === Funksjon for å laste opp bilder til Supabase ===
async function uploadImagesToSupabase(files) {
  const uploadedUrls = [];

  for (const file of files) {
    const filePath = `bilder/${Date.now()}_${file.name}`;

    // Komprimer bildet
    const img = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const MAX_WIDTH = 1024;
    const scale = Math.min(MAX_WIDTH / img.width, 1);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const resizedImageBlob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/jpeg", 0.8);
    });

    // Last opp til Supabase
    const { data, error } = await supabase.storage
      .from("bilder") // Må være riktig bucket
      .upload(filePath, resizedImageBlob, {
        contentType: "image/jpeg",
        upsert: true
      });

    if (error) {
      console.error("Feil ved bildeopplasting:", error);
    } else {
      // Hent offentlig URL
      const { data: publicUrlData } = supabase.storage
        .from("bilder")
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrlData.publicUrl);
    }
  }

  return uploadedUrls; // ✅ Viktig
}




async function generatePDF(dato, områder, fagarbeidere, sjekkpunkter, signatureImage, imageUrls = [], submissionTime, brukerNavn) {
  const { jsPDF } = window.jspdf || window.jspdf.jsPDF;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  await loadCustomFont(doc); // Last inn Roboto kun én gang
  doc.setFont("Roboto"); // Sett Roboto som font



async function loadCustomFont(doc) {
  if (!doc._customFontLoaded) {
    const response = await fetch("Roboto/static/Roboto-Regular.ttf");
    const buffer = await response.arrayBuffer();

    // Trygg konvertering av ArrayBuffer → Base64
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    const base64Font = btoa(binary);

    doc.addFileToVFS("Roboto-Regular.ttf", base64Font);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

    doc._customFontLoaded = true; // ✅ Flag for å unngå repetering
  }
}




  const habBlue = "#0077C8";
  const habGray = "#f4f4f4";

   // === Globale posisjoner ===
  let startX = 10;
  let startY = 30; // ← DEFINER DENNE ÉN GANG HER
  let boxWidth = 190;
  let Y = startY + 8;

  // === HEADER med logo ===
  try {
    const logoUrl = "Hab_Transparant.png"; // Bruk riktig filsti
    const img = await fetch(logoUrl).then(res => res.blob());
    const imgData = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(img);
    });

    doc.setFillColor(habBlue);
    doc.rect(0, 0, 210, 25, "F");
    doc.addImage(imgData, "PNG", 14, 4, 40, 17); // HAB-logo øverst til venstre
  } catch (err) {
    console.warn("Logo kunne ikke lastes:", err);
    doc.setFillColor(habBlue);
    doc.rect(0, 0, 210, 25, "F");
    doc.setTextColor("#fff");
    doc.setFontSize(18);
    doc.text("HAB Construction AS", 14, 16);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor("#fff");
  doc.text("Daglig sjekkliste – Varme arbeider", 130, 16);

  // === Grunninfo ===
 const linjer = [
    `Dato: ${dato}`,
    `Arbeidstid: 07:00 - 18:30`,
    `Innsender: ${brukerNavn || "Ikke oppgitt"}`,
    `Områder: ${områder.length ? områder.join(", ") : "Ingen valgt"}`,
    `Tidspunkt for innsending: ${submissionTime}`
  ];

  
  let boxHeight = linjer.length * 7 + 12;

  doc.setFillColor(habGray);
  doc.roundedRect(startX, startY, boxWidth, boxHeight, 3, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor("#000");
  linjer.forEach(linje => {
    doc.text(linje, 15, Y);
    Y += 7;
  });

// === Fagarbeidere med kurs ===
let fagarbeiderStartY = startY + boxHeight + 25; // ← tidligere var kanskje +5 eller +10

doc.setFillColor(habGray);
doc.roundedRect(startX, fagarbeiderStartY, boxWidth, 80, 3, 3, "F"); // høyde = 80 (eller juster etter behov)

// Tittel
doc.setFont("helvetica", "bold");
doc.setFontSize(12);
doc.setTextColor(habBlue);
doc.text("Fagarbeidere med kurs", startX + 5, fagarbeiderStartY + 10);

// Fagarbeider-navn (kolonnevis)
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.setTextColor("#000");

let col1X = startX + 5;
let col2X = startX + 100;
let rowY = fagarbeiderStartY + 20;

for (let i = 0; i < fagarbeidere.length; i++) {
  const x = i < fagarbeidere.length / 2 ? col1X : col2X;
  const y = rowY + (i % Math.ceil(fagarbeidere.length / 2)) * 6.5;
  doc.text(fagarbeidere[i], x, y);
}


// === SIDE 2: Sjekkpunkter ===
doc.addPage();
doc.setFont("helvetica", "bold");
doc.setFontSize(16);
doc.setTextColor(habBlue);
doc.text("Sjekkpunkter som er markert som utført", 14, 20);

// Bakgrunnsboks
doc.setFillColor(habGray);
doc.roundedRect(10, 30, 190, 250, 3, 3, "F");

// Bruk en font som håndterer tegnene riktig
doc.setFont("courier", "normal");
doc.setFontSize(10);
doc.setTextColor("#000");

let y2 = 40;
const maxWidth = 170;
const lineHeight = 5;

sjekkpunkter.forEach((p, i) => {
  const icon = p.checked ? "X" : "[ ]"; // Disse fungerer nå med Courier
  const punktText = `${i + 1}. ${icon} ${p.text}`;
  const wrapped = doc.splitTextToSize(punktText, maxWidth);

  doc.text(wrapped, 14, y2);
  y2 += (wrapped.length * lineHeight) + 3;

  if (y2 > 260) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(habBlue);
    doc.text("Sjekkpunkter (forts.)", 14, 20);

    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setTextColor("#000");

    y2 = 35;
  }
});

// === SIDE 3: Bilder ===
  if (imageUrls && imageUrls.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Innsendte bilder: (Trykk på lenkene for å åpne bildene):", 14, 20);

    let y = 30;
    imageUrls.forEach((url, index) => {
      doc.setTextColor(0, 102, 204); // Blå
      doc.textWithLink(`Innsendt Bilde ${index + 1}`, 14, y, { url });
      y += 10;
    });
  }








  // === SIDE 4: Signatur ===
  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(habBlue);
  doc.text("Signatur", 14, 30);
  doc.addImage(signatureImage, "PNG", 14, 40, 80, 40);

  return doc.output("blob");
}








// Global variabel for bilder
let uploadedImages = [];
let skiftToday = []; // Global variabel


document.addEventListener("DOMContentLoaded", () => {
  const datoInput = document.getElementById("dato-input");
  const datoHøyre = document.getElementById("dagens-dato-høyre");
  const canvas = document.getElementById("signature");
  const ctx = canvas?.getContext("2d");
  const lagreBtn = document.getElementById("lagre");
  const avsluttBtn = document.getElementById("avslutt");

  // Sett dagens dato
  const iDag = new Date();
  if (datoInput) datoInput.value = iDag.toISOString().split("T")[0];
  if (datoHøyre) {
    datoHøyre.textContent = iDag.toLocaleDateString("no-NO", {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // === Skift og fagarbeidere ===
const skiftData = {
  1: [
    "Stanislaw Stasiak", "Krzysztof Szpak", "Rafal Pater", "Zbigniew Dlubacz", 
    "Pawel Adamski", "Jaroslaw Michalec", "Konrad Mateusz Lazur", "Tomasz Pach", 
    "Marcin Pach", "Stanislaw Ganczarczyk", "Jacek Reszko"
  ],
  2: [
    "Karol Kubik", "Artur Krampikowski", "Marek Mikolajczyk", "Artur Bajcer", 
    "Mariusz Papiez", "Rafal Gebel", "Szymon Wajda", "Pawel Zlydaszyk"
  ],
  3: [
    "Wojciech Robert Fraczek", "Maciej Szustak", "Krzysztof Bialobrzeski", 
    "Sebastian Strzelec", "Piotr Michalczyk", "Jacek Tomasiak", "Lukasz Chochol", 
    "Mateusz Hajn", "Tomasz Skoczen", "Piotr Wierzejski", "Kamil Lewandowski", 
    "Tobiasz Zadworny"
  ]
};


  const startDate = new Date("2025-07-14");

  function oppdaterSkift(datoStr) {
    const arbeiderListe = document.getElementById("arbeiderListe");
    arbeiderListe.innerHTML = "";

    const dato = new Date(datoStr);
    const daysSinceStart = Math.floor((dato - startDate) / (1000 * 60 * 60 * 24));
    const weeksSinceStart = Math.floor(daysSinceStart / 7);
    const dayOfWeek = dato.getDay();
    const weekIndex = ((weeksSinceStart % 3) + 3) % 3;

const mandagMønster = [3, 1, 2];
const ukeMønster = [[3, 1], [1, 2], [2, 3]];


     skiftToday = [];
    if (dayOfWeek === 0) {
      skiftToday = [];
    } else if (dayOfWeek === 1) {
      skiftToday = [mandagMønster[weekIndex]];
    } else {
      skiftToday = ukeMønster[weekIndex];
    }

    if (skiftToday.length === 0) {
      arbeiderListe.innerHTML = "<h3>Ingen skift i dag (søndag)</h3>";
    } else {
      const container = document.createElement("div");
      container.className = "skift-container";
      skiftToday.forEach(skiftNummer => {
        const card = document.createElement("div");
card.className = `skift-block skift-${skiftNummer}`;

        const title = document.createElement("h4");
        title.textContent = `👷 Skift ${skiftNummer}`;
        card.appendChild(title);

        const list = document.createElement("ul");
        skiftData[skiftNummer].forEach(navn => {
          const li = document.createElement("li");
          li.textContent = navn;
          list.appendChild(li);
        });

        card.appendChild(list);
        container.appendChild(card);
      });
      arbeiderListe.appendChild(container);
    }
  }

  if (datoInput) {
    oppdaterSkift(datoInput.value);
    datoInput.addEventListener("change", () => oppdaterSkift(datoInput.value));
  }

  const checkAllBtn = document.getElementById("checkAll");



if (checkAllBtn) {
  let allChecked = false;
  checkAllBtn.addEventListener("click", () => {
    const allCheckboxes = document.querySelectorAll("section input[type='checkbox']");
    allCheckboxes.forEach(cb => cb.checked = !allChecked);
    allChecked = !allChecked;
    checkAllBtn.textContent = allChecked ? "✖ Fjern alle" : "✔ Huk av alle";
  });
}




  // === Signaturtegning ===
  if (canvas && ctx) {
    let isDrawing = false;
    const start = (x, y) => { isDrawing = true; ctx.beginPath(); ctx.moveTo(x, y); };
    const draw = (x, y) => { if (!isDrawing) return; ctx.lineTo(x, y); ctx.stroke(); };
    const stop = () => isDrawing = false;

    canvas.addEventListener("mousedown", e => start(e.offsetX, e.offsetY));
    canvas.addEventListener("mousemove", e => draw(e.offsetX, e.offsetY));
    canvas.addEventListener("mouseup", stop);
    canvas.addEventListener("mouseleave", stop);

    canvas.addEventListener("touchstart", e => {
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      start(t.clientX - r.left, t.clientY - r.top);
    });
    canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      draw(t.clientX - r.left, t.clientY - r.top);
    });
    canvas.addEventListener("touchend", stop);

    document.getElementById("clearSignature")?.addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }

  // === Bildeopplasting og forhåndsvisning ===
  const imageInput = document.querySelector("#imageInput");
  const imagePreview = document.querySelector("#imagePreview");

  if (imageInput && imagePreview) {
    imageInput.addEventListener("change", (event) => {
      const files = Array.from(event.target.files);
      uploadedImages = [];
      imagePreview.innerHTML = "";

      if (files.length === 0) {
        imagePreview.textContent = "Ingen bilder valgt";
        return;
      }

      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          uploadedImages.push(reader.result);
          const img = document.createElement("img");
          img.src = reader.result;
          img.style.width = "100px";
          img.style.height = "100px";
          img.style.objectFit = "cover";
          img.style.margin = "5px";
          img.style.borderRadius = "8px";
          imagePreview.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  // === Lagre-knapp ===
  lagreBtn?.addEventListener("click", async () => {
    const områder = Array.from(document.querySelectorAll(".område.selected")).map(el => el.textContent.trim());
    const checkboxes = Array.from(document.querySelectorAll("section input[type='checkbox']")).map(cb => ({
      checked: cb.checked
    }));

    try {
      const { error } = await supabase.from("Checklists").insert([{
        dato: datoInput.value,
        områder: områder,
        punkter: checkboxes,
        status: "påbegynt",
        signert: false
      }]);
      if (error) throw error;
      showtoast("💾 Fremdrift lagret!");
    } catch (err) {
      console.error("Feil:", err);
      showToast("🚫 Kunne ikke lagre fremdriften.");
    }
  });

  
avsluttBtn?.addEventListener("click", async () => {
  const checkboxes = document.querySelectorAll("section input[type='checkbox']");
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);

  if (!allChecked) {
    showToast("⚠️ Alle sjekkpunkter må være avkrysset for å avslutte.");
    return;
  }
  const loaderOverlay = document.getElementById("loader-overlay");
loaderOverlay.style.display = "flex";

const brukerNavn = document.getElementById("brukerNavn").value.trim();
if (!brukerNavn) {
    alert("⚠️ Du må skrive inn navnet ditt før du sender sjekklisten.");
    return;
}


  const områder = Array.from(document.querySelectorAll(".område.selected")).map(el => el.textContent.trim());
  try {
    const sjekkpunkter = Array.from(document.querySelectorAll("section input[type='checkbox']")).map(cb => ({
      text: cb.parentElement.textContent.trim(),
      checked: cb.checked
    }));

    const fagarbeidere = skiftToday.length > 0
      ? skiftToday.flatMap(skiftNummer => skiftData[skiftNummer])
      : ["Ingen registrert"];

      // ✅ Legg til tidspunkt for innsending
const submissionTime = new Date().toLocaleString('no-NO', { 
  dateStyle: 'short', 
  timeStyle: 'short' 
});


      // ✅ Last opp bilder og hent URL-er
const imageUrls = await uploadImagesToSupabase(document.querySelector("#imageInput").files);

// ✅ Lag PDF med bilde-lenker
const pdfBlob = await generatePDF(datoInput.value, områder, fagarbeidere, sjekkpunkter, canvas.toDataURL(), imageUrls, submissionTime, brukerNavn);

    // ✅ Her setter vi inn punkt nr. 2
  } catch (err) {
    console.error("Feil ved avslutning:", err);
    showToast("🚫 Klarte ikke å avslutte sjekkliste.");
  }

  // === Hent valgte bilder og last opp til Supabase ===
  const files = document.querySelector("#imageInput").files;

  let imageUrls = [];
  if (files.length > 0) {
    imageUrls = await uploadImagesToSupabase(files);
    console.log("Bildene er lastet opp:", imageUrls);
  } else {
    console.log("Ingen bilder valgt.");
  }


 


  try {

const områder = Array.from(document.querySelectorAll(".område.selected")).map(el => el.textContent.trim());

const sjekkpunkter = Array.from(document.querySelectorAll("section input[type='checkbox']")).map(cb => ({
  text: cb.parentElement.textContent.trim(),
  checked: cb.checked
}));

const fagarbeidere = skiftToday.length > 0
  ? skiftToday.flatMap(skiftNummer => skiftData[skiftNummer])
  : ["Ingen registrert"];

  // ✅ Legg til tidspunkt for innsending
const submissionTime = new Date().toLocaleString('no-NO', { 
  dateStyle: 'short', 
  timeStyle: 'short' 
});


// ✅ Lag PDF med ny funksjon
const pdfBlob = await generatePDF(
  datoInput.value,
  områder,
  fagarbeidere,
  sjekkpunkter,
  canvas.toDataURL(),
  imageUrls, // ← Legg til denne
  submissionTime, // ✅ Ny parameter
  brukerNavn
);


// ✅ Last opp til Supabase
const fileName = `sjekkliste_${Date.now()}.pdf`;
const { data, error } = await supabase.storage
  .from("sjekklister")
  .upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: true });

if (error) throw error;

// ✅ Hent public URL
const { data: publicUrlData } = supabase.storage
  .from("sjekklister")
  .getPublicUrl(fileName);
const pdfUrl = publicUrlData.publicUrl;

// ✅ Send e-post via EmailJS
await emailjs.send("service_ciql98i", "template_ijnei7l", {
  username: brukerNavn,
  date: datoInput.value,
  areas: områder.join(", "),
  message: "Her er dagens sjekkliste.",
  fagarbeidere: fagarbeidere.join("\n"),
  pdf_link: pdfUrl,
  signatureImage: canvas.toDataURL(),
  image_links: imageUrls.join("\n"),
  submission_time: submissionTime
});

const fullfortScreen = document.getElementById("fullfort-screen");
const mainContainer = document.querySelector(".container");

if (fullfortScreen && mainContainer) {
    mainContainer.style.display = "none";  // Skjul sjekklisten
    fullfortScreen.style.display = "block"; // Vis fullført-skjerm
}




  } catch (err) {
    console.error("Feil ved avslutning:", err);
    showToast("🚫 Klarte ikke å avslutte sjekkliste.");
  }
  finally {
    // ✅ Skjul loader når alt er ferdig
    loaderOverlay.style.display = "none";
  }
});

});

// === Områdevalg for kart ===
function toggleSelection(element) {
  element.classList.toggle("selected");
  updateSelectedAreas();
}

function updateSelectedAreas() {
  const selected = document.querySelectorAll(".område.selected");
  const visning = document.getElementById("valgte-områder-visning");
  visning.innerHTML = "<span style='font-weight:bold; color:#ffd;'>Valgt:</span>";
  selected.forEach(el => {
    const span = document.createElement("span");
    span.textContent = el.textContent.trim();
    visning.appendChild(span);
  });
}

function showToast(message, duration = 4000) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => container.removeChild(toast), 400);
  }, duration);
}
