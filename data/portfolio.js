/* ===================================================================
   Pingping Portfolio — SAMPLE / FALLBACK DATA
   -------------------------------------------------------------------
   This data is shown ONLY when no Google Sheet is connected in
   data/config.js (sheetCsvUrl is empty), or if the sheet fails to load.
   Once your Google Sheet is connected, the live sheet data is used
   instead and you can ignore this file.
   =================================================================== */
window.PORTFOLIO_DATA = {
  "entries": [
    {
      "title": "National Mathematics Olympiad",
      "category": "Math & Science",
      "level": "National",
      "date": "2024-08-15",
      "ageAtEvent": 14,
      "grade": "Grade 9",
      "organizer": "The Mathematical Association of Thailand",
      "result": "Gold Medal",
      "description": "Placed first among 480 finalists in the senior division, solving advanced problems in algebra, geometry, and number theory.",
      "skills": ["Problem Solving", "Logical Reasoning", "Algebra"],
      "attachments": [
        { "type": "image", "label": "Gold Medal Certificate", "file": "assets/certificates/sample-certificate.svg" },
        { "type": "pdf", "label": "Official Results (PDF)", "file": "assets/certificates/sample-results.pdf" }
      ]
    },
    {
      "title": "Regional Science Fair",
      "category": "Math & Science",
      "level": "Regional",
      "date": "2023-11-20",
      "ageAtEvent": 13,
      "grade": "Grade 8",
      "organizer": "Office of the Basic Education Commission",
      "result": "1st Runner-up",
      "description": "Presented a project on low-cost water filtration using locally sourced materials. Recognized for experimental design and clear presentation.",
      "skills": ["Research", "Experiment Design", "Presentation"],
      "attachments": [
        { "type": "image", "label": "Award Certificate", "file": "assets/certificates/sample-certificate.svg" }
      ]
    },
    {
      "title": "International Youth Piano Competition",
      "category": "Arts & Music",
      "level": "International",
      "date": "2023-06-10",
      "ageAtEvent": 13,
      "grade": "Grade 8",
      "organizer": "Asia-Pacific Music Foundation",
      "result": "Silver Award",
      "description": "Performed Chopin and Beethoven repertoire in the junior category, earning a Silver Award among competitors from 12 countries.",
      "skills": ["Piano", "Performance", "Discipline"],
      "attachments": [
        { "type": "pdf", "label": "Competition Certificate (PDF)", "file": "assets/certificates/sample-results.pdf" }
      ]
    },
    {
      "title": "National English Speaking Contest",
      "category": "Language",
      "level": "National",
      "date": "2022-09-05",
      "ageAtEvent": 12,
      "grade": "Grade 7",
      "organizer": "Ministry of Education",
      "result": "Finalist",
      "description": "Selected as a national finalist for an impromptu speech on environmental responsibility.",
      "skills": ["Public Speaking", "English", "Confidence"],
      "attachments": [
        { "type": "image", "label": "Finalist Certificate", "file": "assets/certificates/sample-certificate.svg" }
      ]
    },
    {
      "title": "Provincial Swimming Championship",
      "category": "Other",
      "level": "Provincial",
      "date": "2021-07-18",
      "ageAtEvent": 11,
      "grade": "Grade 6",
      "organizer": "Provincial Sports Authority",
      "result": "Gold Medal — 50m Freestyle",
      "description": "Set a new age-group record in the 50m freestyle event.",
      "skills": ["Swimming", "Endurance", "Teamwork"],
      "attachments": [
        { "type": "image", "label": "Gold Medal Certificate", "file": "assets/certificates/sample-certificate.svg" }
      ]
    },
    {
      "title": "Children's National Art Exhibition",
      "category": "Arts & Music",
      "level": "National",
      "date": "2019-12-01",
      "ageAtEvent": 9,
      "grade": "Grade 4",
      "organizer": "National Gallery",
      "result": "Honorable Mention",
      "description": "Artwork selected from thousands of entries to be displayed at the national children's art exhibition.",
      "skills": ["Drawing", "Creativity", "Color Theory"],
      "attachments": [
        { "type": "image", "label": "Certificate of Participation", "file": "assets/certificates/sample-certificate.svg" }
      ]
    },
    {
      "title": "School Spelling Bee",
      "category": "Language",
      "level": "School",
      "date": "2018-02-14",
      "ageAtEvent": 8,
      "grade": "Grade 3",
      "organizer": "Pingping's Primary School",
      "result": "Champion",
      "description": "Won the school-wide spelling bee in the lower-primary division.",
      "skills": ["Vocabulary", "Memory", "Focus"],
      "attachments": [
        { "type": "image", "label": "Champion Certificate", "file": "assets/certificates/sample-certificate.svg" }
      ]
    }
  ]
};
