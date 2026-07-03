export const EXAM_SECTIONS = [
  { id: "A", name: "HTML MCQ", startIdx: 0, endIdx: 4 },
  { id: "B", name: "HTML Practical", startIdx: 5, endIdx: 6 },
  { id: "C", name: "Python MCQ", startIdx: 7, endIdx: 10 },
  { id: "D", name: "Python Programming", startIdx: 11, endIdx: 13 },
  { id: "E", name: "Java MCQ", startIdx: 14, endIdx: 18 },
  { id: "F", name: "Verbal Ability - Tenses", startIdx: 19, endIdx: 28 }
];

export const EXAM_QUESTIONS = [
  // SECTION A: HTML MCQ (10 Marks total, 2 marks each)
  {
    section: "A",
    type: "mcq",
    question: "Which tag inserts a horizontal line?",
    options: ["<line>", "<hr>", "<br>", "<hl>"],
    answer: 1, // "<hr>"
    marks: 2
  },
  {
    section: "A",
    type: "mcq",
    question: "Which tag creates a numbered list?",
    options: ["<ul>", "<ol>", "<li>", "<list>"],
    answer: 1, // "<ol>"
    marks: 2
  },
  {
    section: "A",
    type: "mcq",
    question: "Which HTML tag is used for the largest heading?",
    options: ["<h6>", "<head>", "<h1>", "<title>"],
    answer: 2, // "<h1>"
    marks: 2
  },
  {
    section: "A",
    type: "mcq",
    question: "Which tag defines a table cell?",
    options: ["<tr>", "<td>", "<th>", "<table>"],
    answer: 1, // "<td>"
    marks: 2
  },
  {
    section: "A",
    type: "mcq",
    question: "Which tag is used to create a drop-down list?",
    options: ["<option>", "<select>", "<dropdown>", "<list>"],
    answer: 1, // "<select>"
    marks: 2
  },

  // SECTION B: HTML Practical (5 Marks total)
  {
    section: "B",
    type: "html_code_input",
    question: "Question 1: Display only the browser output image. Students must write the HTML code that produces the given output.",
    image: "assets/html_02072026/html2.png",
    marks: 3
  },
  {
    section: "B",
    type: "dragdrop",
    question: "Question 2: Display the same browser output image. Provide the HTML code in shuffled order. Students must arrange the code using drag-and-drop.",
    image: "assets/html_02072026/html2.png",
    correctOrder: [
      "<h1>Student Details</h1>",
      "<p>Name: John</p>",
      "<ul>",
      "  <li>Python</li>",
      "  <li>HTML</li>",
      "  <li>Java</li>",
      "</ul>"
    ],
    shuffledOrder: [
      "  <li>HTML</li>",
      "<ul>",
      "<h1>Student Details</h1>",
      "  <li>Java</li>",
      "</ul>",
      "<p>Name: John</p>",
      "  <li>Python</li>"
    ],
    marks: 2
  },

  // SECTION C: Python MCQ (10 Marks total, 2.5 marks each)
  {
    section: "C",
    type: "mcq",
    question: "Which operator is used for logical AND in Python?",
    options: ["&&", "&", "and", "AND"],
    answer: 2, // "and"
    marks: 2.5
  },
  {
    section: "C",
    type: "mcq",
    question: "What is the output?\n\nprint(len(\"Python\"))",
    options: ["5", "6", "7", "Error"],
    answer: 1, // "6"
    marks: 2.5
  },
  {
    section: "C",
    type: "mcq",
    question: "What is the output?\n\nx = [10, 20, 30]\nprint(x[-1])",
    options: ["10", "20", "30", "Error"],
    answer: 2, // "30"
    marks: 2.5
  },
  {
    section: "C",
    type: "mcq",
    question: "Which keyword is used to stop a loop?",
    options: ["stop", "break", "exit", "continue"],
    answer: 1, // "break"
    marks: 2.5
  },

  // SECTION D: Python Programming (10 Marks total)
  {
    section: "D",
    type: "dragdrop",
    question: "Program 1 – Reverse a List (Drag & Drop)",
    correctOrder: [
      "numbers = [10, 20, 30, 40]",
      "numbers.reverse()",
      "print(numbers)"
    ],
    shuffledOrder: [
      "print(numbers)",
      "numbers = [10, 20, 30, 40]",
      "numbers.reverse()"
    ],
    marks: 3
  },
  {
    section: "D",
    type: "dragdrop",
    question: "Program 2 – Simple Interest (Drag & Drop)",
    correctOrder: [
      "p = 1000",
      "r = 5",
      "t = 2",
      "si = (p * r * t) / 100",
      "print(si)"
    ],
    shuffledOrder: [
      "si = (p * r * t) / 100",
      "p = 1000",
      "print(si)",
      "t = 2",
      "r = 5"
    ],
    marks: 3
  },
  {
    section: "D",
    type: "fillblanks",
    question: "Program 3 – Area of Circle (Fill in the Blanks)",
    codeTemplate: "radius = [BLANK1]\narea = [BLANK2] * radius * radius\nprint(area)",
    blanks: [
      {
        id: "BLANK1",
        options: ["int(input())", "input()", "float", "print()"],
        answer: 0 // "int(input())"
      },
      {
        id: "BLANK2",
        options: ["radius", "3.14", "area", "pi()"],
        answer: 1 // "3.14"
      }
    ],
    marks: 4
  },

  // SECTION E: Java MCQ (5 Marks total, 1 mark each)
  {
    section: "E",
    type: "mcq",
    question: "Java is a ______ language.",
    options: ["Compiled only", "Interpreted only", "Both Compiled and Interpreted", "Assembly"],
    answer: 2, // "Both Compiled and Interpreted"
    marks: 1
  },
  {
    section: "E",
    type: "mcq",
    question: "Which method is the entry point of a Java program?",
    options: ["start()", "run()", "main()", "execute()"],
    answer: 2, // "main()"
    marks: 1
  },
  {
    section: "E",
    type: "mcq",
    question: "Which data type stores whole numbers?",
    options: ["float", "int", "double", "boolean"],
    answer: 1, // "int"
    marks: 1
  },
  {
    section: "E",
    type: "mcq",
    question: "Java is a ______ language.",
    options: ["Platform Dependent", "Platform Independent", "Machine Dependent", "None"],
    answer: 1, // "Platform Independent"
    marks: 1
  },
  {
    section: "E",
    type: "mcq",
    question: "Which symbol is used to end a statement in Java?",
    options: [":", ";", ",", "."],
    answer: 1, // ";"
    marks: 1
  },

  // SECTION F: Verbal Ability – Tenses (10 Marks total, 1 mark each)
  {
    section: "F",
    type: "mcq",
    question: "She ______ to college every day. (Verb: go)",
    options: ["go", "goes", "going", "gone"],
    answer: 1, // "goes"
    marks: 1
  },
  {
    section: "F",
    type: "mcq",
    question: "They ______ dinner when I arrived. (Verb: have)",
    options: ["have", "had", "were having", "having"],
    answer: 2, // "were having"
    marks: 1
  },
  {
    section: "F",
    type: "mcq",
    question: "He ______ the assignment yesterday. (Verb: complete)",
    options: ["complete", "completes", "completed", "completing"],
    answer: 2, // "completed"
    marks: 1
  },
  {
    section: "F",
    type: "mcq",
    question: "We ______ our project next week. (Verb: finish)",
    options: ["finish", "finished", "will finish", "finishing"],
    answer: 2, // "will finish"
    marks: 1
  },
  {
    section: "F",
    type: "mcq",
    question: "She ______ a book now. (Verb: read)",
    options: ["reads", "read", "is reading", "reading"],
    answer: 2, // "is reading"
    marks: 1
  },
  {
    section: "F",
    type: "mcq",
    question: "The train ______ before we reached the station. (Verb: leave)",
    options: ["leaves", "left", "had left", "leaving"],
    answer: 2, // "had left"
    marks: 1
  },
  {
    section: "F",
    type: "mcq",
    question: "I ______ in Chennai since 2023. (Verb: live)",
    options: ["lived", "have lived", "live", "living"],
    answer: 1, // "have lived"
    marks: 1
  },
  {
    section: "F",
    type: "mcq",
    question: "If it rains, we ______ at home. (Verb: stay)",
    options: ["stayed", "stay", "will stay", "staying"],
    answer: 2, // "will stay"
    marks: 1
  },
  {
    section: "F",
    type: "mcq",
    question: "They ______ the match already. (Verb: win)",
    options: ["won", "win", "have won", "winning"],
    answer: 2, // "have won"
    marks: 1
  },
  {
    section: "F",
    type: "mcq",
    question: "By next year, I ______ my degree. (Verb: complete)",
    options: ["complete", "completed", "will have completed", "completing"],
    answer: 2, // "will have completed"
    marks: 1
  }
];
