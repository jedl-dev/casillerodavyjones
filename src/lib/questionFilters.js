const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const ALL = 'Todas';

export function categoriesOf(questions) {
  return [...new Set(questions.map((question) => question.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
}

export function filterQuestions(questions, { search = '', difficulty = ALL, category = ALL } = {}) {
  const query = normalize(search);

  return questions.filter((question) => {
    if (difficulty !== ALL && question.difficulty !== difficulty) return false;
    if (category !== ALL && question.category !== category) return false;
    if (!query) return true;

    return [question.question_text, question.category, question.difficulty, question.correct_answer]
      .some((field) => normalize(field).includes(query));
  });
}
