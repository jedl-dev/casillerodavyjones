import React, { useEffect, useMemo, useState } from 'react';
import Link from '../components/Link';
import '../ui.css';
import { getSession, onAuthChange, signInAdmin, signOutAdmin } from '../lib/auth';
import {
  createQuestion,
  deleteQuestion,
  getGameSettings,
  listQuestions,
  updateGameSettings,
  updateQuestion
} from '../lib/quizApi';
import { ALL, categoriesOf, filterQuestions } from '../lib/questionFilters';

const DIFFICULTIES = ['Muy Fácil', 'Fácil', 'Intermedia', 'Difícil', 'Muy Difícil', 'Imposible'];

const EMPTY = {
  question_text: '',
  options: ['', '', '', ''],
  correct_answer: '',
  difficulty: 'Fácil',
  image_file: '',
  category: 'General'
};

const EMPTY_FILTERS = { search: '', difficulty: ALL, category: ALL };

const emptyForm = () => ({ ...EMPTY, options: [...EMPTY.options] });

function Admin({ navigate }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = onAuthChange(setSession);
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="op-page"><p className="op-subtitle">Cargando...</p></div>;
  }

  if (!session) return <Login onLogin={setSession} navigate={navigate} />;

  const isAdmin = session.user?.app_metadata?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="op-page">
        <div className="op-card">
          <h1 className="op-title-sm">Sin permisos</h1>
          <p className="op-subtitle">
            La cuenta {session.user?.email} no tiene el rol admin en app_metadata.
          </p>
          <button className="op-btn" onClick={() => signOutAdmin()}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  return <Panel email={session.user.email} navigate={navigate} onLogout={() => signOutAdmin()} />;
}

function Login({ onLogin, navigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    const { data, error: signInError } = await signInAdmin(email, password);

    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onLogin(data.session);
  };

  return (
    <div className="op-page">
      <form className="op-card" onSubmit={submit}>
        <div className="op-admin-card-head">
          <h1 className="op-title">Administración</h1>
          <span className="op-admin-badge">Solo en desarrollo</span>
        </div>
        <p className="op-subtitle">
          Panel local para editar el banco de preguntas. Acceso restringido a cuentas con rol admin.
        </p>
        <p className="op-note">La cuenta necesita <code>app_metadata.role = "admin"</code>.</p>

        <label className="op-label" htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          className="op-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
        />

        <label className="op-label" htmlFor="admin-password">Contraseña</label>
        <input
          id="admin-password"
          className="op-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p className="op-error" role="alert">{error}</p>}

        <button className="op-btn op-btn--primary" type="submit" disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
        <Link className="op-back" to="/" navigate={navigate}>← Volver al inicio</Link>
      </form>
    </div>
  );
}

function Panel({ email, navigate, onLogout }) {
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');
  const [listError, setListError] = useState('');
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => filterQuestions(questions, filters), [questions, filters]);
  const categories = useMemo(() => categoriesOf(questions), [questions]);
  const filtersActive = filters.search.trim() !== ''
    || filters.difficulty !== ALL
    || filters.category !== ALL;

  const refresh = async () => {
    setLoading(true);
    try {
      setQuestions(await listQuestions());
      setListError('');
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const setOption = (index, value) => setForm((current) => {
    const options = [...current.options];
    const previous = options[index];
    options[index] = value;
    const correct_answer = current.correct_answer === previous ? value : current.correct_answer;
    return { ...current, options, correct_answer };
  });

  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

  const reset = () => {
    setForm(emptyForm());
    setFormError('');
  };

  const focusForm = () => document.getElementById('q-text')?.focus();

  const edit = (question) => {
    setForm({ ...question, options: [...question.options], image_file: question.image_file || '' });
    setFormError('');
    focusForm();
  };

  const duplicate = (question) => {
    const copy = { ...question };
    delete copy.id;
    delete copy.created_at;
    setForm({
      ...emptyForm(),
      ...copy,
      options: [...question.options],
      question_text: `${question.question_text} (copia)`,
      image_file: question.image_file || ''
    });
    setFormError('');
    focusForm();
  };

  const save = async (event) => {
    event.preventDefault();
    setFormError('');

    const options = form.options.map((option) => option.trim());

    if (!form.question_text.trim()) {
      setFormError('Falta el texto de la pregunta.');
      return;
    }
    if (options.some((option) => !option)) {
      setFormError('Completa las 4 opciones.');
      return;
    }
    if (new Set(options).size !== 4) {
      setFormError('Las 4 opciones deben ser distintas.');
      return;
    }
    if (!options.includes(form.correct_answer.trim())) {
      setFormError('La respuesta correcta debe ser una de las opciones.');
      return;
    }

    const payload = {
      question_text: form.question_text.trim(),
      options,
      correct_answer: form.correct_answer.trim(),
      difficulty: form.difficulty,
      image_file: form.image_file.trim() || null,
      category: form.category.trim() || 'General'
    };

    setBusy(true);
    try {
      if (form.id) await updateQuestion(form.id, payload);
      else await createQuestion(payload);
      reset();
      await refresh();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (question) => {
    if (!window.confirm(`¿Eliminar "${question.question_text}"?`)) return;
    setListError('');
    try {
      await deleteQuestion(question.id);
      if (form.id === question.id) reset();
      await refresh();
    } catch (err) {
      setListError(err.message);
    }
  };

  return (
    <div className="op-page op-page--top">
      <div className="op-admin-shell">
        <div className="op-admin-head">
          <div>
            <h1 className="op-title">Preguntas</h1>
            <p className="op-subtitle">{email}</p>
          </div>
          <div className="op-actions">
            <span className="op-admin-badge">Solo en desarrollo</span>
            <Link className="op-btn op-btn--ghost" to="/" navigate={navigate}>Volver al inicio</Link>
            <button className="op-btn op-btn--ghost" onClick={onLogout}>Cerrar sesión</button>
          </div>
        </div>

        <SettingsPanel />

        <form className="op-card op-card--wide op-card--admin" onSubmit={save}>
          <div className="op-admin-card-head">
            <h2 className="op-title-sm">{form.id ? 'Editar pregunta' : 'Nueva pregunta'}</h2>
            {form.id && <span className="op-admin-badge">Editando</span>}
          </div>

          <label className="op-label" htmlFor="q-text">Pregunta</label>
          <textarea
            id="q-text"
            className="op-input op-textarea"
            value={form.question_text}
            onChange={(event) => setField('question_text', event.target.value)}
            rows={2}
            placeholder="¿Qué pregunta entra al archivo?"
          />

          <div className="op-grid-2">
            {form.options.map((option, index) => (
              <div key={index}>
                <label className="op-label" htmlFor={`option-${index}`}>
                  Opción {String.fromCharCode(65 + index)}
                </label>
                <input
                  id={`option-${index}`}
                  className="op-input"
                  value={option}
                  onChange={(event) => setOption(index, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="op-grid-2">
            <div>
              <label className="op-label" htmlFor="q-correct">Respuesta correcta</label>
              <select
                id="q-correct"
                className="op-input"
                value={form.correct_answer}
                onChange={(event) => setField('correct_answer', event.target.value)}
              >
                <option value="">Elige una opción...</option>
                {form.options.map((option, index) => (
                  option.trim() ? <option key={index} value={option}>{option}</option> : null
                ))}
              </select>
            </div>

            <div>
              <label className="op-label" htmlFor="q-difficulty">Dificultad</label>
              <select
                id="q-difficulty"
                className="op-input"
                value={form.difficulty}
                onChange={(event) => setField('difficulty', event.target.value)}
              >
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>{difficulty}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="op-label" htmlFor="q-category">Categoría</label>
              <input
                id="q-category"
                className="op-input"
                list="q-category-options"
                value={form.category}
                onChange={(event) => setField('category', event.target.value)}
              />
              <datalist id="q-category-options">
                {categories.map((category) => <option key={category} value={category} />)}
              </datalist>
            </div>

            <div>
              <label className="op-label" htmlFor="q-image">Imagen (opcional)</label>
              <input
                id="q-image"
                className="op-input"
                value={form.image_file}
                onChange={(event) => setField('image_file', event.target.value)}
                placeholder="assets/..."
              />
            </div>
          </div>

          {formError && <p className="op-error" role="alert">{formError}</p>}

          <div className="op-actions">
            <button className="op-btn op-btn--primary" type="submit" disabled={busy}>
              {busy ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear pregunta'}
            </button>
            <button className="op-btn op-btn--ghost" type="button" onClick={reset}>
              {form.id ? 'Cancelar edición' : 'Limpiar'}
            </button>
          </div>
        </form>

        <section className="op-card op-card--wide op-card--admin">
          <div className="op-admin-card-head">
            <h2 className="op-title-sm">Guardadas</h2>
            <span className="op-admin-count">{questions.length} preguntas</span>
          </div>

          <div className="op-admin-toolbar" role="search">
            <div className="op-admin-search">
              <label className="op-label" htmlFor="admin-search">Buscar</label>
              <input
                id="admin-search"
                className="op-input"
                type="search"
                value={filters.search}
                onChange={(event) => setFilter('search', event.target.value)}
                placeholder="Pregunta, categoría o respuesta"
              />
            </div>

            <div className="op-admin-filter">
              <label className="op-label" htmlFor="admin-difficulty">Dificultad</label>
              <select
                id="admin-difficulty"
                className="op-input"
                value={filters.difficulty}
                onChange={(event) => setFilter('difficulty', event.target.value)}
              >
                {[ALL, ...DIFFICULTIES].map((difficulty) => (
                  <option key={difficulty} value={difficulty}>{difficulty}</option>
                ))}
              </select>
            </div>

            <div className="op-admin-filter">
              <label className="op-label" htmlFor="admin-category">Categoría</label>
              <select
                id="admin-category"
                className="op-input"
                value={filters.category}
                onChange={(event) => setFilter('category', event.target.value)}
              >
                {[ALL, ...categories].map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {filtersActive && (
              <button
                type="button"
                className="op-btn op-btn--ghost op-admin-clear"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                Limpiar
              </button>
            )}
          </div>

          <p className="op-admin-meta" aria-live="polite">
            Mostrando {visible.length} de {questions.length}
          </p>

          {listError && <p className="op-error" role="alert">{listError}</p>}

          {loading ? (
            <p className="op-admin-empty">Cargando preguntas...</p>
          ) : visible.length ? (
            <ul className="op-admin-list">
              {visible.map((question) => (
                <li key={question.id}>
                  <div className="op-admin-question">
                    <div className="op-admin-question-head">
                      <span className="op-diff">{question.difficulty}</span>
                      <span className="op-admin-category">{question.category}</span>
                    </div>
                    <p>{question.question_text}</p>
                    <small>Correcta: {question.correct_answer}</small>
                  </div>
                  <div className="op-actions">
                    <button type="button" className="op-btn op-btn--ghost" onClick={() => edit(question)}>Editar</button>
                    <button type="button" className="op-btn op-btn--ghost" onClick={() => duplicate(question)}>Duplicar</button>
                    <button type="button" className="op-btn op-btn--danger" onClick={() => remove(question)}>Eliminar</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="op-admin-empty">
              <p>{questions.length ? 'Ninguna pregunta coincide con el filtro.' : 'No hay preguntas todavía.'}</p>
              {questions.length
                ? <button className="op-btn op-btn--ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar filtros</button>
                : <p className="op-subtitle">Crea la primera arriba.</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const SETTINGS_GROUPS = [
  {
    title: 'Vidas',
    fields: [
      { key: 'lives_start', label: 'Vidas al empezar' },
      { key: 'lives_max', label: 'Tope de vidas' }
    ]
  },
  {
    title: 'Rondas por marea',
    fields: [
      { key: 'rounds_facil', label: 'F?cil' },
      { key: 'rounds_intermedia', label: 'Intermedia' },
      { key: 'rounds_dificil', label: 'Dif?cil' },
      { key: 'rounds_muy_dificil', label: 'Muy Dif?cil' },
      { key: 'rounds_imposible', label: 'Imposible' }
    ]
  },
  {
    title: 'Puntos por acierto',
    fields: [
      { key: 'points_facil', label: 'F?cil' },
      { key: 'points_intermedia', label: 'Intermedia' },
      { key: 'points_dificil', label: 'Dif?cil' },
      { key: 'points_muy_dificil', label: 'Muy Dif?cil' },
      { key: 'points_imposible', label: 'Imposible' }
    ]
  },
  {
    title: 'Racha',
    fields: [
      { key: 'streak_step1_at', label: 'Paso 1 desde' },
      { key: 'streak_step1_mult', label: 'Multiplicador 1', step: '0.05' },
      { key: 'streak_step2_at', label: 'Paso 2 desde' },
      { key: 'streak_step2_mult', label: 'Multiplicador 2', step: '0.05' },
      { key: 'streak_step3_at', label: 'Paso 3 desde' },
      { key: 'streak_step3_mult', label: 'Multiplicador 3', step: '0.05' }
    ]
  },
  {
    title: 'Bonus final',
    fields: [
      { key: 'bonus_unused_wildcard', label: 'Comod?n sin usar' },
      { key: 'bonus_life', label: 'Vida restante' }
    ]
  },
  {
    title: 'Ruleta',
    fields: [
      { key: 'roulette_start_min', label: 'Inicio m?nimo' },
      { key: 'roulette_start_max', label: 'Inicio m?ximo' },
      { key: 'roulette_mid_min', label: 'Mitad m?nimo' },
      { key: 'roulette_mid_max', label: 'Mitad m?ximo' }
    ]
  }
];

function SettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getGameSettings()
      .then(setSettings)
      .catch((err) => setError(err.message));
  }, []);

  const setField = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { ...settings };
      delete payload.id;
      delete payload.updated_at;
      Object.keys(payload).forEach((key) => {
        payload[key] = Number(payload[key]);
      });
      setSettings(await updateGameSettings(payload));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return (
      <section className="op-card op-card--wide op-card--admin">
        <h2 className="op-title-sm">Ajustes del juego</h2>
        <p className="op-admin-empty">{error || 'Cargando ajustes...'}</p>
      </section>
    );
  }

  return (
    <form className="op-card op-card--wide op-card--admin" onSubmit={save}>
      <div className="op-admin-card-head">
        <h2 className="op-title-sm">Ajustes del juego</h2>
        <span className="op-admin-badge">Modo solo</span>
      </div>
      <p className="op-note">
        Valores que usan las partidas nuevas. Las partidas en curso conservan los suyos.
      </p>

      <div className="op-grid-2">
        {SETTINGS_GROUPS.map((group) => (
          <fieldset key={group.title} className="op-settings-group">
            <legend className="op-label">{group.title}</legend>
            {group.fields.map((field) => (
              <label key={field.key} className="op-settings-field">
                <span>{field.label}</span>
                <input
                  className="op-input"
                  type="number"
                  min="0"
                  step={field.step || '1'}
                  value={settings[field.key] ?? ''}
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      {error && <p className="op-error" role="alert">{error}</p>}

      <div className="op-actions">
        <button className="op-btn op-btn--primary" type="submit" disabled={busy}>
          {busy ? 'Guardando...' : 'Guardar ajustes'}
        </button>
        {saved && <span className="op-admin-meta">Guardado</span>}
      </div>
    </form>
  );
}

export default Admin;
