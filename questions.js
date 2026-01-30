// questions.js
// Interchangeable question packs live here.

const QUESTION_SETS = {
  "party-dk-v1": {
    title: "Party DK (v1)",
    description: "Let, sjovt, mobil-venligt.",
    questions: [
      { id: "pd1", text: "Hvilken planet kaldes ofte den røde planet?", options: ["Jorden", "Mars", "Jupiter", "Venus"], correctIndex: 1 },
      { id: "pd2", text: "Hvad er hovedstaden i Danmark?", options: ["Aarhus", "Odense", "København", "Aalborg"], correctIndex: 2 },
      { id: "pd3", text: "Hvad hedder Danmarks valuta?", options: ["Euro", "Kroner", "Pund", "Dollar"], correctIndex: 1 },
      { id: "pd4", text: "Hvilket dyr siger 'mjau'?", options: ["Hund", "Kat", "Ko", "Får"], correctIndex: 1 },
      { id: "pd5", text: "Hvilken farve får du ved at blande blå + gul?", options: ["Lilla", "Orange", "Grøn", "Brun"], correctIndex: 2 }
    ]
  },

  "science-nerd-v1": {
    title: "Science Nerd (v1)",
    description: "Lidt nørdet, lidt smart.",
    questions: [
      { id: "sn1", text: "Hvad er kemisk symbol for vand?", options: ["O2", "CO2", "H2O", "NaCl"], correctIndex: 2 },
      { id: "sn2", text: "Hvad måler en volt?", options: ["Strøm", "Spænding", "Modstand", "Effekt"], correctIndex: 1 },
      { id: "sn3", text: "Hvilken partikel har negativ ladning?", options: ["Proton", "Neutron", "Elektron", "Foton"], correctIndex: 2 },
      { id: "sn4", text: "Hvor mange minutter er der i en time?", options: ["50", "60", "70", "80"], correctIndex: 1 },
      { id: "sn5", text: "Hvad er 2^3?", options: ["6", "8", "9", "12"], correctIndex: 1 }
    ]
  },

  "spicy-meds-v1": {
    title: "Spicy Meds (v1)",
    description: "Læge-nørd med lidt attitude.",
    questions: [
      { id: "sm1", text: "Hvilket organ producerer insulin?", options: ["Lever", "Pankreas", "Nyre", "Lunge"], correctIndex: 1 },
      { id: "sm2", text: "Hvad står EKG for?", options: ["Electrocardiogram", "Electrocapillary graph", "Endocrine control guide", "Emergency care grid"], correctIndex: 0 },
      { id: "sm3", text: "Normal voksen RF er ca.?", options: ["2-4", "12-20", "30-40", "50-60"], correctIndex: 1 },
      { id: "sm4", text: "Hvilket er et penicillin?", options: ["Amoxicillin", "Ciprofloxacin", "Doxycycline", "Gentamicin"], correctIndex: 0 },
      { id: "sm5", text: "Hvad er max GCS?", options: ["10", "12", "15", "20"], correctIndex: 2 }
    ]
  }
};

module.exports = { QUESTION_SETS };
