import React from 'react';

const isPlainClick = (event) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

const Link = ({ to, navigate, onClick, children, ...rest }) => {
  const handleClick = (event) => {
    if (onClick) onClick(event);
    if (event.defaultPrevented || !isPlainClick(event)) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};

export default Link;
