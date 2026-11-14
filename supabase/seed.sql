-- Datos de ejemplo para probar el juego. Sin migración de datos.
-- 4 preguntas por dificultad: suficiente para el modo solo (15 rondas) y salas (10).

insert into public.questions (question_text, options, correct_answer, difficulty, category)
values
  ('¿Cómo se llama el protagonista de One Piece?',
   jsonb_build_array('Monkey D. Luffy', 'Roronoa Zoro', 'Portgas D. Ace', 'Sanji'),
   'Monkey D. Luffy', 'Fácil', 'General'),

  ('¿Qué fruta del diablo comió Luffy?',
   jsonb_build_array('Gomu Gomu no Mi', 'Mera Mera no Mi', 'Bara Bara no Mi', 'Hito Hito no Mi'),
   'Gomu Gomu no Mi', 'Fácil', 'General'),

  ('¿Cuál es el sueño de Luffy?',
   jsonb_build_array('Ser el Rey de los Piratas', 'Encontrar el All Blue', 'Ser el mejor espadachín', 'Ser Almirante de la Marina'),
   'Ser el Rey de los Piratas', 'Fácil', 'General'),

  ('¿Quién es el cocinero de los Piratas de Sombrero de Paja?',
   jsonb_build_array('Sanji', 'Zoro', 'Usopp', 'Franky'),
   'Sanji', 'Fácil', 'Tripulación'),

  ('¿Quién fue el Rey de los Piratas?',
   jsonb_build_array('Gol D. Roger', 'Barbablanca', 'Kaido', 'Shanks'),
   'Gol D. Roger', 'Intermedia', 'Historia'),

  ('¿Qué tipo de fruta es la Gura Gura no Mi?',
   jsonb_build_array('Paramecia', 'Logia', 'Zoan', 'Zoan Mitológica'),
   'Paramecia', 'Intermedia', 'Frutas'),

  ('¿Quién es la navegante de los Piratas de Sombrero de Paja?',
   jsonb_build_array('Nami', 'Nico Robin', 'Vivi', 'Carrot'),
   'Nami', 'Intermedia', 'Tripulación'),

  ('¿Cómo se llama el hermano de Luffy que comió la Mera Mera no Mi?',
   jsonb_build_array('Portgas D. Ace', 'Sabo', 'Marshall D. Teach', 'Shanks'),
   'Portgas D. Ace', 'Intermedia', 'Personajes'),

  ('¿Qué almirante de la Marina tiene la fruta Hie Hie no Mi?',
   jsonb_build_array('Aokiji', 'Kizaru', 'Akainu', 'Fujitora'),
   'Aokiji', 'Difícil', 'Marina'),

  ('¿Cómo se llama la isla natal de Nico Robin?',
   jsonb_build_array('Ohara', 'Water 7', 'Skypiea', 'Zou'),
   'Ohara', 'Difícil', 'Historia'),

  ('¿Qué usuario tiene la Ope Ope no Mi?',
   jsonb_build_array('Trafalgar Law', 'Eustass Kid', 'Basil Hawkins', 'Scratchmen Apoo'),
   'Trafalgar Law', 'Difícil', 'Personajes'),

  ('¿Cómo se llama el barco de los Piratas de Roger?',
   jsonb_build_array('Oro Jackson', 'Thousand Sunny', 'Going Merry', 'Red Force'),
   'Oro Jackson', 'Difícil', 'Barcos'),

  ('¿Cómo se llama la espada negra de Mihawk?',
   jsonb_build_array('Yoru', 'Enma', 'Shusui', 'Wado Ichimonji'),
   'Yoru', 'Muy Difícil', 'Objetos'),

  ('¿Qué miembro de los Piratas de Roger sabía leer los Poneglyphs?',
   jsonb_build_array('Kozuki Oden', 'Silvers Rayleigh', 'Scopper Gaban', 'Buggy'),
   'Kozuki Oden', 'Muy Difícil', 'Historia'),

  ('¿Qué usuario tiene la Soru Soru no Mi?',
   jsonb_build_array('Charlotte Linlin', 'Charlotte Katakuri', 'Charlotte Perospero', 'Charlotte Pudding'),
   'Charlotte Linlin', 'Muy Difícil', 'Personajes'),

  ('¿Cómo se llaman las armas ancestrales?',
   jsonb_build_array('Plutón, Poseidón y Urano', 'Plutón, Neptuno y Urano', 'Poseidón, Hades y Zeus', 'Plutón, Poseidón y Nika'),
   'Plutón, Poseidón y Urano', 'Muy Difícil', 'Historia'),

  ('¿Cómo se llama el padre de Usopp?',
   jsonb_build_array('Yasopp', 'Shanks', 'Benn Beckman', 'Lucky Roux'),
   'Yasopp', 'Imposible', 'Personajes'),

  ('¿Qué nombre tiene la espada de Shanks?',
   jsonb_build_array('Gryphon', 'Yoru', 'Enma', 'Ace'),
   'Gryphon', 'Imposible', 'Objetos'),

  ('¿Cómo se llama la madre de Shirahoshi?',
   jsonb_build_array('Otohime', 'Neptune', 'Fukaboshi', 'Madam Shyarly'),
   'Otohime', 'Imposible', 'Personajes'),

  ('¿Cuál es la recompensa de Luffy tras Wano?',
   jsonb_build_array('3,000,000,000 Berries', '1,500,000,000 Berries', '4,000,000,000 Berries', '500,000,000 Berries'),
   '3,000,000,000 Berries', 'Imposible', 'General')
,

  ('¿Quién le enseñó a Luffy a usar el Haki en Amazon Lily?',
   jsonb_build_array('Silvers Rayleigh', 'Shanks', 'Boa Hancock', 'Jinbe'),
   'Silvers Rayleigh', 'Fácil', 'Haki'),

  ('¿Qué Baroque Works usaba como tapadera en Whiskey Peak?',
   jsonb_build_array('Una agencia de cazadores de recompensas', 'Una taberna pirata', 'Una base de la Marina', 'Un astillero'),
   'Una agencia de cazadores de recompensas', 'Intermedia', 'Organizaciones')
on conflict (question_text) do nothing;
