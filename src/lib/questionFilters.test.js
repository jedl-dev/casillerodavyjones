import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL, categoriesOf, filterQuestions } from './questionFilters.js';

const QUESTIONS = [
  { question_text: '¿Quién es Luffy?', difficulty: 'Fácil', category: 'Personajes', correct_answer: 'Monkey D. Luffy' },
  { question_text: '¿Qué fruta comió Luffy?', difficulty: 'Fácil', category: 'Frutas', correct_answer: 'Gomu Gomu no Mi' },
  { question_text: '¿Quién fue el Rey de los Piratas?', difficulty: 'Difícil', category: 'Historia', correct_answer: 'Gol D. Roger' }
];

test('filtra por dificultad y categoría', () => {
  assert.equal(filterQuestions(QUESTIONS, { difficulty: 'Fácil' }).length, 2);
  assert.equal(filterQuestions(QUESTIONS, { category: 'Frutas' }).length, 1);
  assert.equal(filterQuestions(QUESTIONS, { difficulty: ALL, category: ALL }).length, 3);
});

test('la búsqueda ignora tildes y mayúsculas', () => {
  assert.equal(filterQuestions(QUESTIONS, { search: 'dificil' }).length, 1);
  assert.equal(filterQuestions(QUESTIONS, { search: 'QUIEN' }).length, 2);
  assert.equal(filterQuestions(QUESTIONS, { search: 'piratas' }).length, 1);
});

test('devuelve categorías únicas y ordenadas', () => {
  assert.deepEqual(categoriesOf(QUESTIONS), ['Frutas', 'Historia', 'Personajes']);
});
