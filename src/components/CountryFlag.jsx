import React from 'react';

// Banderas simplificadas (24×16) de la lista de países del perfil.
const FLAGS = {
  AR: (
    <>
      <rect width="24" height="16" fill="#74acdf" />
      <rect y="5.3" width="24" height="5.4" fill="#fff" />
      <circle cx="12" cy="8" r="1.6" fill="#f6b40e" />
    </>
  ),
  BO: (
    <>
      <rect width="24" height="5.33" fill="#d52b1e" />
      <rect y="5.33" width="24" height="5.33" fill="#f9e300" />
      <rect y="10.66" width="24" height="5.34" fill="#007934" />
    </>
  ),
  CL: (
    <>
      <rect width="24" height="8" fill="#fff" />
      <rect y="8" width="24" height="8" fill="#d52b1e" />
      <rect width="8" height="8" fill="#0039a6" />
      <path d="M4 2.2l.7 2.1H6.9L5.2 5.6l.6 2L4 6.4l-1.8 1.2.6-2L1.1 4.3h2.2z" fill="#fff" />
    </>
  ),
  CO: (
    <>
      <rect width="24" height="8" fill="#fcd116" />
      <rect y="8" width="24" height="4" fill="#003893" />
      <rect y="12" width="24" height="4" fill="#ce1126" />
    </>
  ),
  CR: (
    <>
      <rect width="24" height="16" fill="#002b7f" />
      <rect y="2.3" width="24" height="11.4" fill="#fff" />
      <rect y="4.6" width="24" height="6.8" fill="#ce1126" />
    </>
  ),
  CU: (
    <>
      <rect width="24" height="16" fill="#002a8f" />
      <rect y="3.2" width="24" height="3.2" fill="#fff" />
      <rect y="9.6" width="24" height="3.2" fill="#fff" />
      <path d="M0 0l10 8-10 8z" fill="#cb1515" />
      <circle cx="4" cy="8" r="1.2" fill="#fff" />
    </>
  ),
  DO: (
    <>
      <rect width="12" height="8" fill="#002d62" />
      <rect x="12" width="12" height="8" fill="#ce1126" />
      <rect y="8" width="12" height="8" fill="#ce1126" />
      <rect x="12" y="8" width="12" height="8" fill="#002d62" />
      <rect x="10" width="4" height="16" fill="#fff" />
      <rect y="6" width="24" height="4" fill="#fff" />
    </>
  ),
  EC: (
    <>
      <rect width="24" height="8" fill="#ffdd00" />
      <rect y="8" width="24" height="4" fill="#034ea2" />
      <rect y="12" width="24" height="4" fill="#ed1c24" />
      <circle cx="12" cy="8" r="1.8" fill="#7a5a2b" />
    </>
  ),
  ES: (
    <>
      <rect width="24" height="16" fill="#aa151b" />
      <rect y="4" width="24" height="8" fill="#f1bf00" />
    </>
  ),
  GB: (
    <>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#ffffff" strokeWidth="3.2" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#c8102e" strokeWidth="1.5" />
      <path d="M12 0v16M0 8h24" stroke="#ffffff" strokeWidth="5" />
      <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="2.6" />
    </>
  ),
  MX: (
    <>
      <rect width="8" height="16" fill="#006847" />
      <rect x="8" width="8" height="16" fill="#f7f7f7" />
      <rect x="16" width="8" height="16" fill="#ce1126" />
      <circle cx="12" cy="8" r="1.4" fill="#8a6a3b" />
    </>
  ),
  PE: (
    <>
      <rect width="8" height="16" fill="#d91023" />
      <rect x="8" width="8" height="16" fill="#fff" />
      <rect x="16" width="8" height="16" fill="#d91023" />
    </>
  ),
  PR: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect y="2" width="24" height="2" fill="#ed0000" />
      <rect y="6" width="24" height="2" fill="#ed0000" />
      <rect y="10" width="24" height="2" fill="#ed0000" />
      <rect y="14" width="24" height="2" fill="#ed0000" />
      <path d="M0 0l9 8-9 8z" fill="#0050f0" />
      <circle cx="3.4" cy="8" r="1" fill="#fff" />
    </>
  ),
  UY: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect y="2.3" width="24" height="1.8" fill="#0038a8" />
      <rect y="5.9" width="24" height="1.8" fill="#0038a8" />
      <rect y="9.4" width="24" height="1.8" fill="#0038a8" />
      <rect y="12.9" width="24" height="1.8" fill="#0038a8" />
      <rect width="9" height="8" fill="#fff" />
      <circle cx="4.5" cy="4" r="1.6" fill="#fcd116" />
    </>
  ),
  US: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect y="1.2" width="24" height="1.2" fill="#b22234" />
      <rect y="3.7" width="24" height="1.2" fill="#b22234" />
      <rect y="6.2" width="24" height="1.2" fill="#b22234" />
      <rect y="8.7" width="24" height="1.2" fill="#b22234" />
      <rect y="11.2" width="24" height="1.2" fill="#b22234" />
      <rect y="13.7" width="24" height="1.2" fill="#b22234" />
      <rect width="10" height="8" fill="#3c3b6e" />
      <circle cx="2.5" cy="2" r=".6" fill="#fff" />
      <circle cx="5" cy="2" r=".6" fill="#fff" />
      <circle cx="7.5" cy="2" r=".6" fill="#fff" />
      <circle cx="3.7" cy="4" r=".6" fill="#fff" />
      <circle cx="6.2" cy="4" r=".6" fill="#fff" />
      <circle cx="2.5" cy="6" r=".6" fill="#fff" />
      <circle cx="5" cy="6" r=".6" fill="#fff" />
      <circle cx="7.5" cy="6" r=".6" fill="#fff" />
    </>
  ),
  VE: (
    <>
      <rect width="24" height="5.33" fill="#ffce00" />
      <rect y="5.33" width="24" height="5.33" fill="#0033a0" />
      <rect y="10.66" width="24" height="5.34" fill="#cf142b" />
      <circle cx="9" cy="4.4" r=".5" fill="#fff" />
      <circle cx="12" cy="4.1" r=".5" fill="#fff" />
      <circle cx="15" cy="4.4" r=".5" fill="#fff" />
    </>
  )
};

const CountryFlag = ({ code, className }) => {
  const flag = FLAGS[code];
  if (!flag) return null;

  return (
    <svg className={className} viewBox="0 0 24 16" aria-hidden="true">
      {flag}
    </svg>
  );
};

export default CountryFlag;
