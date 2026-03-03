  export const formatTokens = (value) => {
    if (!Number.isFinite(value)) return '-';
    return value.toLocaleString();
  };
  export const formatCurrency = (value) => {
    if (!Number.isFinite(value)) return 'n/a';
    return `$${value.toFixed(2)}`;
  };