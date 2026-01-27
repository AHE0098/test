// questions.js
// =====================
// Question packs live here.
// Switch packs via CFG.QUESTION_SET_KEY in config.js
// correctIndex is 0-based (0 = first option).
// =====================

const QUESTION_SETS = {
  "party-dk-v1": {
    title: "Party DK (v1)",
    description: "Let, sjovt, mobil-venligt (mix af DK + random facts).",
    questions: [
      {
        id: "pd1",
        text: "Hvilken planet kaldes ofte den røde planet?",
        options: ["Jorden", "Mars", "Jupiter", "Venus"],
        correctIndex: 1
      },
      {
        id: "pd2",
        text: "Hvad er hovedstaden i Danmark?",
        options: ["Aarhus", "Odense", "København", "Aalborg"],
        correctIndex: 2
      },
      {
        id: "pd3",
        text: "Hvad betyder 'PDF' typisk i dokument-sammenhæng?",
        options: [
          "Portable Document Format",
          "Public Data Folder",
          "Private Document Function",
          "Print-Driven File"
        ],
        correctIndex: 0
      },
      {
        id: "pd4",
        text: "Hvilket dyr kan IKKE flyve?",
        options: ["Flagermus", "Pingvin", "Kolibri", "Svale"],
        correctIndex: 1
      },
      {
        id: "pd5",
        text: "Hvad er ca. kogepunktet for vand ved havniveau?",
        options: ["80°C", "90°C", "100°C", "110°C"],
        correctIndex: 2
      },
      {
        id: "pd6",
        text: "Hvilket land er kendt for at have byen Reykjavik som hovedstad?",
        options: ["Norge", "Island", "Irland", "Finland"],
        correctIndex: 1
      },
      {
        id: "pd7",
        text: "Hvilken af disse er typisk IKKE en primær farve i RGB?",
        options: ["Rød", "Grøn", "Blå", "Gul"],
        correctIndex: 3
      },
      {
        id: "pd8",
        text: "Hvad hedder den store bro mellem København og Malmø?",
        options: ["Storebæltsbroen", "Øresundsbroen", "Lillebæltsbroen", "Kattegatbroen"],
        correctIndex: 1
      },
      {
        id: "pd9",
        text: "Hvilket tal kommer efter 999?",
        options: ["1000", "1001", "990", "1100"],
        correctIndex: 0
      },
      {
        id: "pd10",
        text: "Hvis du har 10 sekunder, hvor mange millisekunder er det?",
        options: ["100", "1.000", "10.000", "100.000"],
        correctIndex: 2
      }
    ]
  },

  "science-nerd-v1": {
    title: "Science Nerd (v1)",
    description: "Lidt mere nørdet, stadig hurtig og sjov.",
    questions: [
      {
        id: "sn1",
        text: "Hvilken partikel har negativ ladning?",
        options: ["Proton", "Neutron", "Elektron", "Positron"],
        correctIndex: 2
      },
      {
        id: "sn2",
        text: "Hvilket grundstof har symbolet 'Fe'?",
        options: ["Fluor", "Fosfor", "Jern", "Fermium"],
        correctIndex: 2
      },
      {
        id: "sn3",
        text: "Hvilken af disse er IKKE en tilstandsform?",
        options: ["Fast", "Flydende", "Gas", "Lys"],
        correctIndex: 3
      },
      {
        id: "sn4",
        text: "Hvad er den mest udbredte gas i Jordens atmosfære (ca.)?",
        options: ["Oxygen", "Nitrogen", "Kuldioxid", "Argon"],
        correctIndex: 1
      },
      {
        id: "sn5",
        text: "Hvilken enhed måler elektrisk strøm?",
        options: ["Volt", "Ohm", "Ampere", "Watt"],
        correctIndex: 2
      }
    ]
  }
};

module.exports = { QUESTION_SETS };
