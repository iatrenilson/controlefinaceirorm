/**
 * Maps database/API errors to safe user-friendly messages.
 * Prevents leaking internal schema details, table names, and constraint info.
 */
export const getSafeErrorMessage = (error: any): string => {
  if (!error) return 'Ocorreu um erro inesperado.';

  const code = error.code;
  const message = (error.message || '').toLowerCase();

  // Map common Postgres error codes
  if (code === '23505') return 'Este registro já existe.';
  if (code === '23503') return 'Operação inválida: registro relacionado não encontrado.';
  if (code === '23502') return 'Todos os campos obrigatórios devem ser preenchidos.';
  if (code === '23514') return 'Valor inválido para esta operação.';
  if (code === '42501') return 'Você não tem permissão para esta operação.';
  if (code === '42P01') return 'Recurso não encontrado.';
  if (code === 'PGRST301') return 'Você não tem permissão para esta operação.';

  // Map common error messages
  if (message.includes('row-level security')) return 'Você não tem permissão para esta operação.';
  if (message.includes('jwt') || message.includes('token')) return 'Sessão expirada. Faça login novamente.';
  if (message.includes('duplicate')) return 'Este registro já existe.';
  if (message.includes('not found')) return 'Registro não encontrado.';
  if (message.includes('network') || message.includes('fetch')) return 'Erro de conexão. Verifique sua internet.';
  if (message.includes('timeout')) return 'Tempo de resposta excedido. Tente novamente.';

  // Generic fallback - never expose raw error
  console.error('Database error:', error);
  return 'Ocorreu um erro. Tente novamente ou contate o suporte.';
};
