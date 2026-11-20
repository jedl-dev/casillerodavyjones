import React, { useEffect, useMemo, useState } from 'react';
import Link from '../components/Link';
import '../ui.css';
import { getSession, onAuthChange, signInAdmin, signOutAdmin } from '../lib/auth';
import {
  createQuestion,
  deleteQuestion,
  getGameSettings,
  listQuestionCategories,
  listQuestionReports,
  listQuestions,
  resolveQuestionReport,
  updateGameSettings,
  updateQuestion
} from '../lib/quizApi';
import { ALL } from '../lib/questionFilters';
import { ART_SLOTS, resolveArt } from '../lib/gameArt';

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
            Esta cuenta no tiene permisos de administración.
          </p>
          <button className="op-btn" onClick={() => signOutAdmin()}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  return <Panel navigate={navigate} onLogout={() => signOutAdmin()} />;
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
          Preguntas, reportes y ajustes del quiz. Acceso restringido a cuentas con rol admin.
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

function Panel({ navigate, onLogout }) {
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');
  const [listError, setListError] = useState('');
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState('preguntas');
  const [questionView, setQuestionView] = useState('banco');
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState([]);

  const visible = questions;
  const filtersActive = filters.search.trim() !== ''
    || filters.difficulty !== ALL
    || filters.category !== ALL;
  const PAGE_SIZE = 20;

  const loadQuestions = async ({ append = false } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const { rows, total: count } = await listQuestions({
        search: filters.search.trim(),
        difficulty: filters.difficulty === ALL ? '' : filters.difficulty,
        category: filters.category === ALL ? '' : filters.category,
        from: append ? questions.length : 0,
        size: PAGE_SIZE
      });

      setQuestions((current) => (append ? [...current, ...rows] : rows));
      setTotal(count);
      setListError('');
    } catch (err) {
      setListError(err.message);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadQuestions();
    }, filters.search ? 260 : 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.difficulty, filters.category]);

  useEffect(() => {
    listQuestionCategories().then(setCategories).catch(() => setCategories([]));
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
    setQuestionView('editor');
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
    setQuestionView('editor');
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
      await loadQuestions();
      setQuestionView('banco');
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
      await loadQuestions();
    } catch (err) {
      setListError(err.message);
    }
  };

  return (
    <div className="op-page op-page--top">
      <div className="op-admin-shell">
        <div className="op-admin-head">
          <div>
            <h1 className="op-title">Administración</h1>
            <p className="op-subtitle">Preguntas, reportes y ajustes del quiz.</p>
          </div>
          <div className="op-actions">
            <span className="op-admin-badge">Solo en desarrollo</span>
            <Link className="op-btn op-btn--ghost" to="/" navigate={navigate}>Volver al inicio</Link>
            <button className="op-btn op-btn--ghost" onClick={onLogout}>Cerrar sesión</button>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Secciones de administración">
          {[
            { key: 'preguntas', label: 'Preguntas' },
            { key: 'reportes', label: 'Reportes' },
            { key: 'ajustes', label: 'Ajustes del quiz' },
            { key: 'arte', label: 'Arte de juegos' }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-nav__tab${section === item.key ? ' is-current' : ''}`}
              aria-pressed={section === item.key}
              onClick={() => setSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {section === 'ajustes' && <SettingsPanel />}

        {section === 'arte' && <ArtPanel />}

        {section === 'reportes' && (
          <ReportsPanel
            onEditQuestion={(questionId) => {
              const target = questions.find((question) => question.id === questionId);
              if (!target) return;
              edit(target);
              setSection('preguntas');
              setQuestionView('editor');
            }}
          />
        )}

        {section === 'preguntas' && (
          <>
            <div className="admin-subnav" role="group" aria-label="Vista de preguntas">
              <button
                type="button"
                className={`admin-subnav__tab${questionView === 'banco' ? ' is-current' : ''}`}
                aria-pressed={questionView === 'banco'}
                onClick={() => setQuestionView('banco')}
              >
                Banco ({questions.length})
              </button>
              <button
                type="button"
                className={`admin-subnav__tab${questionView === 'editor' ? ' is-current' : ''}`}
                aria-pressed={questionView === 'editor'}
                onClick={() => setQuestionView('editor')}
              >
                {form.id ? 'Editando' : 'Nueva pregunta'}
              </button>
            </div>

        {questionView === 'editor' && (
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
        )}

        {questionView === 'banco' && (
        <section className="op-card op-card--wide op-card--admin">
          <div className="op-admin-card-head">
            <h2 className="op-title-sm">Banco de preguntas</h2>
            <span className="op-admin-count">{total} preguntas</span>
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
            Mostrando {visible.length} de {total}
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
              {total
                ? <button className="op-btn op-btn--ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar filtros</button>
                : <p className="op-subtitle">Crea la primera en el editor.</p>}
            </div>
          )}

          {visible.length < total && (
            <button
              type="button"
              className="op-btn op-admin-more"
              onClick={() => loadQuestions({ append: true })}
              disabled={loadingMore}
            >
              {loadingMore ? 'Cargando...' : `Cargar ${Math.min(PAGE_SIZE, total - visible.length)} más`}
            </button>
          )}
        </section>
        )}
          </>
        )}
      </div>
    </div>
  );
}

const REPORT_REASONS = {
  respuesta: 'Respuesta incorrecta',
  dificultad: 'Dificultad mal puesta',
  otro: 'Otro'
};

function ReportsPanel({ onEditQuestion }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    reason: ALL,
    difficulty: ALL,
    category: ALL,
    showResolved: false
  });

  const load = async () => {
    setLoading(true);
    try {
      setReports(await listQuestionReports());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const found = reports.map((report) => report.questions?.category).filter(Boolean);
    return [...new Set(found)].sort();
  }, [reports]);

  const visible = reports.filter((report) => {
    const question = report.questions || {};
    if (!filters.showResolved && report.resolved_at) return false;
    if (filters.reason !== ALL && report.reason !== filters.reason) return false;
    if (filters.difficulty !== ALL && question.difficulty !== filters.difficulty) return false;
    if (filters.category !== ALL && question.category !== filters.category) return false;
    if (filters.search) {
      const haystack = `${question.question_text || ''} ${report.note || ''}`.toLowerCase();
      if (!haystack.includes(filters.search.toLowerCase())) return false;
    }
    return true;
  });

  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

  const toggle = async (report) => {
    setBusyId(report.id);
    try {
      await resolveQuestionReport(report.id, !report.resolved_at);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="op-card op-card--wide op-card--admin">
      <div className="op-admin-card-head">
        <h2 className="op-title-sm">Preguntas reportadas</h2>
        <span className="op-admin-count">{visible.length} de {reports.length}</span>
      </div>

      <div className="op-admin-toolbar" role="search">
        <div className="op-admin-search">
          <label className="op-label" htmlFor="report-search">Buscar</label>
          <input
            id="report-search"
            className="op-input"
            type="search"
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            placeholder="Pregunta o nota"
          />
        </div>

        <div className="op-admin-filter">
          <label className="op-label" htmlFor="report-reason">Motivo</label>
          <select
            id="report-reason"
            className="op-input"
            value={filters.reason}
            onChange={(event) => setFilter('reason', event.target.value)}
          >
            {[ALL, ...Object.keys(REPORT_REASONS)].map((reason) => (
              <option key={reason} value={reason}>
                {reason === ALL ? 'Todos' : REPORT_REASONS[reason]}
              </option>
            ))}
          </select>
        </div>

        <div className="op-admin-filter">
          <label className="op-label" htmlFor="report-difficulty">Dificultad</label>
          <select
            id="report-difficulty"
            className="op-input"
            value={filters.difficulty}
            onChange={(event) => setFilter('difficulty', event.target.value)}
          >
            {[ALL, ...DIFFICULTIES].map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty === ALL ? 'Todas' : difficulty}
              </option>
            ))}
          </select>
        </div>

        <div className="op-admin-filter">
          <label className="op-label" htmlFor="report-category">Categoría</label>
          <select
            id="report-category"
            className="op-input"
            value={filters.category}
            onChange={(event) => setFilter('category', event.target.value)}
          >
            {[ALL, ...categories].map((category) => (
              <option key={category} value={category}>
                {category === ALL ? 'Todas' : category}
              </option>
            ))}
          </select>
        </div>

        <label className="op-admin-check">
          <input
            type="checkbox"
            checked={filters.showResolved}
            onChange={(event) => setFilter('showResolved', event.target.checked)}
          />
          Ver revisados
        </label>
      </div>

      {error && <p className="op-error" role="alert">{error}</p>}

      {loading ? (
        <p className="op-admin-empty">Cargando reportes...</p>
      ) : visible.length ? (
        <ul className="admin-reports">
          {visible.map((report) => {
            const question = report.questions || {};
            return (
              <li key={report.id} className={report.resolved_at ? 'is-resolved' : ''}>
                <div className="admin-reports__body">
                  <div className="admin-reports__chips">
                    <span className="op-diff">{question.difficulty || 'Sin dificultad'}</span>
                    <span className="op-admin-category">{question.category || 'General'}</span>
                    <span className="admin-reports__reason">{REPORT_REASONS[report.reason] || report.reason}</span>
                    {report.resolved_at && <span className="admin-reports__done">Revisado</span>}
                  </div>
                  <p className="admin-reports__question">
                    {question.question_text || 'La pregunta ya no existe'}
                  </p>
                  {question.correct_answer && (
                    <small className="admin-reports__answer">Correcta: {question.correct_answer}</small>
                  )}
                  {report.note && <p className="admin-reports__note">“{report.note}”</p>}
                  <span className="admin-reports__date">
                    {new Date(report.created_at).toLocaleString('es-ES')}
                  </span>
                </div>

                <div className="op-actions">
                  {question.id && (
                    <button
                      type="button"
                      className="op-btn op-btn--ghost"
                      onClick={() => onEditQuestion(question.id)}
                    >
                      Editar
                    </button>
                  )}
                  <button
                    type="button"
                    className={`op-btn${report.resolved_at ? ' op-btn--ghost' : ''}`}
                    onClick={() => toggle(report)}
                    disabled={busyId === report.id}
                  >
                    {report.resolved_at ? 'Reabrir' : 'Marcar revisado'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="op-admin-empty">
          <p>
            {reports.length
              ? 'Ningún reporte coincide con el filtro.'
              : 'Nadie ha reportado preguntas todavía.'}
          </p>
        </div>
      )}
    </section>
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
      { key: 'rounds_facil', label: 'Fácil' },
      { key: 'rounds_intermedia', label: 'Intermedia' },
      { key: 'rounds_dificil', label: 'Difícil' },
      { key: 'rounds_muy_dificil', label: 'Muy Difícil' },
      { key: 'rounds_imposible', label: 'Imposible' }
    ]
  },
  {
    title: 'Puntos por acierto',
    fields: [
      { key: 'points_facil', label: 'Fácil' },
      { key: 'points_intermedia', label: 'Intermedia' },
      { key: 'points_dificil', label: 'Difícil' },
      { key: 'points_muy_dificil', label: 'Muy Difícil' },
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
      { key: 'bonus_unused_wildcard', label: 'Comodín sin usar' },
      { key: 'bonus_life', label: 'Vida restante' }
    ]
  },
  {
    title: 'Tiempo',
    fields: [
      { key: 'question_seconds', label: 'Segundos base' },
      { key: 'question_seconds_step', label: 'Extra por marea' },
      { key: 'time_bonus_per_second', label: 'Bonus por segundo' }
    ]
  },
  {
    title: 'Apuestas',
    fields: [
      { key: 'bets_per_run', label: 'Apuestas por partida' }
    ]
  },
  {
    title: 'Ruleta',
    fields: [
      { key: 'roulette_good', label: 'Peso bueno (%)' },
      { key: 'roulette_neutral', label: 'Peso neutral (%)' },
      { key: 'roulette_bad', label: 'Peso maldici\u00f3n (%)' },
      { key: 'roulette_per_tide', label: 'Tiradas por bandera' }
    ]
  },
  {
    title: 'Comodines',
    fields: [
      { key: 'wildcards_max', label: 'Tope en mano' },
      { key: 'yami_life_cost', label: 'Vidas que quita Yami' }
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

      <div className="op-settings-grid">
        {SETTINGS_GROUPS.map((group) => (
          <fieldset key={group.title} className="op-settings-group">
            <legend className="op-label">{group.title}</legend>
            {group.fields.map((field) => (
              <label key={field.key} className="op-settings-field">
                <span>{field.label}</span>
                <input
                  className="op-input"
                  type="number"
                  inputMode="numeric"
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

const ART_HELP = {
  'quiz-solo': 'Card «Solo» del Quiz.',
  'quiz-multijugador': 'Card «Multijugador» del Quiz.'
};

function ArtPanel() {
  const [found, setFound] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all(Object.keys(ART_SLOTS).map(async (key) => [key, await resolveArt(key)]))
      .then((entries) => {
        if (alive) setFound(Object.fromEntries(entries));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="op-card op-card--wide op-card--admin">
      <div className="op-admin-card-head">
        <h2 className="op-title-sm">Arte de los juegos</h2>
        <span className="op-admin-badge">Carpeta</span>
      </div>

      <p className="op-note">
        Sube las imágenes a <code>public/assets/juegos/</code>. El nombre del archivo decide
        en qué juego y modo aparece; un <code>.webp</code> con ese nombre gana sobre el SVG de ejemplo.
      </p>

      <div className="op-art-grid">
        {Object.entries(ART_SLOTS).map(([key, slot]) => (
          <article className="op-art-card" key={key}>
            <div className="op-art-card__shot">
              {found?.[key] ? (
                <img src={found[key]} alt="" />
              ) : (
                <span className="op-art-card__empty">
                  {found ? 'Falta la imagen' : 'Buscando...'}
                </span>
              )}
            </div>

            <div className="op-art-card__meta">
              <h3>{slot.label}</h3>
              <p>{ART_HELP[key]}</p>
              <code className="op-art-path">
                /assets/juegos/{slot.file}.webp · .png · .svg · .jpg
              </code>
              <span className={`op-art-state${found?.[key] ? ' is-live' : ''}`}>
                {found?.[key] ? `Activo: ${found[key]}` : 'Sin archivo todavía'}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Admin;
