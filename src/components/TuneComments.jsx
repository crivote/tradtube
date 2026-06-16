import { Show, For, createSignal, createEffect, on } from 'solid-js';
import { getComments, addComment, updateComment, deleteComment } from '../lib/supabase';

function TuneComments(props) {
  const { tuneId, authUser, showToast, t } = props;
  const limit = 20;

  const [comments, setComments] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [offset, setOffset] = createSignal(0);
  const [hasMore, setHasMore] = createSignal(false);
  const [loadedInitial, setLoadedInitial] = createSignal(false);
  const [body, setBody] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [editingId, setEditingId] = createSignal(null);
  const [editBody, setEditBody] = createSignal('');

  const loadComments = async (reset = false) => {
    if (loading()) return;
    setLoading(true);
    try {
      const off = reset ? 0 : offset();
      const result = await getComments(tuneId(), { limit, offset: off });
      if (reset) {
        setComments(result);
        setOffset(result.length);
      } else {
        setComments(prev => [...prev, ...result]);
        setOffset(prev => prev + result.length);
      }
      setHasMore(result.length === limit);
    } catch {
      showToast(t('comments.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  createEffect(on(
    () => tuneId(),
    (id) => {
      if (!id) return;
      setComments([]);
      setOffset(0);
      setHasMore(false);
      setLoadedInitial(false);
      loadComments(true).then(() => setLoadedInitial(true));
    },
    { defer: false }
  ));

  const handleSubmit = async () => {
    const text = body().trim();
    if (!text) return;
    setSubmitting(true);
    const user = authUser();
    try {
      const newComment = await addComment(tuneId(), text);
      setBody('');
      setComments(prev => [...prev, {
        ...newComment,
        profiles: {
          display_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
          avatar_url: user?.user_metadata?.avatar_url || null,
        },
      }]);
      setOffset(prev => prev + 1);
      showToast(t('comments.posted'), 'success');
      await loadComments(true);
    } catch {
      showToast(t('comments.postError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditBody('');
  };

  const handleSaveEdit = async (commentId) => {
    const text = editBody().trim();
    if (!text || text === comments().find(c => c.id === commentId)?.body) {
      handleCancelEdit();
      return;
    }
    try {
      await updateComment(commentId, text);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, body: text, edited_at: new Date().toISOString() } : c));
      setEditingId(null);
      setEditBody('');
      showToast(t('comments.edited'), 'success');
    } catch {
      showToast(t('comments.editError'), 'error');
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      showToast(t('comments.deleted'), 'success');
    } catch {
      showToast(t('comments.deleteError'), 'error');
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t('comments.justNow');
    if (diffMins < 60) return t('comments.minutesAgo', { n: diffMins });
    if (diffHours < 24) return t('comments.hoursAgo', { n: diffHours });
    if (diffDays < 7) return t('comments.daysAgo', { n: diffDays });
    return d.toLocaleDateString();
  };

  const getInitial = (profile) => {
    const name = profile?.display_name || '';
    return name.charAt(0).toUpperCase() || '?';
  };

  const canModify = (comment) => {
    const user = authUser();
    if (!user) return false;
    return user.id === comment.user_id || user.isAdmin;
  };

  const remainingChars = () => {
    const editing = editingId();
    const text = editing ? editBody() : body();
    return 2000 - text.length;
  };

  const showCounter = () => remainingChars() < 200;

  const activeCharCount = () => {
    return editingId() ? editBody().length : body().length;
  };

  return (
    <div class="flex flex-col gap-4 mt-8 border-t border-[var(--color-border)] pt-6">
      <h3 class="text-lg font-bold text-[var(--color-text)]">{t('comments.title')}</h3>

      <Show when={!loadedInitial() && loading()}>
        <div class="flex items-center gap-3 py-4 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">{t('comments.loading')}</span>
        </div>
      </Show>

      <Show when={loadedInitial()}>
        <Show
          when={comments().length > 0}
          fallback={
            <p class="text-sm text-[var(--color-muted)]">{t('comments.noComments')}</p>
          }
        >
          <div class="flex flex-col gap-4">
            <For each={comments()}>
              {(comment) => {
                const profile = comment.profiles ?? {};
                const isEditing = () => editingId() === comment.id;
                return (
                  <div class="flex gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-white/40 dark:bg-white/5">
                    <Show
                      when={profile.avatar_url}
                      fallback={
                        <div class="w-8 h-8 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center flex-shrink-0 text-xs font-bold text-[var(--color-primary)]">
                          {getInitial(profile)}
                        </div>
                      }
                    >
                      <img
                        src={profile.avatar_url}
                        alt=""
                        class="w-8 h-8 rounded-full flex-shrink-0 object-cover"
                      />
                    </Show>
                    <div class="flex flex-col gap-1 min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-semibold text-[var(--color-text)]">
                          {profile.display_name || t('comments.anonymous')}
                        </span>
                        <span class="text-xs text-[var(--color-muted)]">
                          {formatDate(comment.created_at)}
                          <Show when={comment.edited_at}>
                            <span class="italic"> ({t('comments.editedLabel')})</span>
                          </Show>
                        </span>
                      </div>
                      <Show
                        when={isEditing()}
                        fallback={
                          <p class="text-sm text-[var(--color-text)] whitespace-pre-wrap break-words">
                            {comment.body}
                          </p>
                        }
                      >
                        <div class="flex flex-col gap-2">
                          <textarea
                            value={editBody()}
                            onInput={(e) => setEditBody(e.currentTarget.value)}
                            maxLength="2000"
                            rows="3"
                            class="w-full text-sm p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] resize-y focus:outline-none focus:border-[var(--color-primary)]"
                          />
                          <Show when={showCounter()}>
                            <span class={`text-xs ${remainingChars() < 0 ? 'text-red-400' : 'text-[var(--color-muted)]'}`}>
                              {t('comments.charsLeft', { n: remainingChars() })}
                            </span>
                          </Show>
                          <div class="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(comment.id)}
                              disabled={editBody().trim().length === 0}
                              class="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                            >
                              {t('comments.save')}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                            >
                              {t('comments.cancel')}
                            </button>
                          </div>
                        </div>
                      </Show>
                      <Show when={canModify(comment) && !isEditing()}>
                        <div class="flex gap-2 mt-1">
                          <button
                            onClick={() => handleEdit(comment)}
                            class="text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
                          >
                            {t('comments.edit')}
                          </button>
                          <button
                            onClick={() => handleDelete(comment.id)}
                            class="text-xs text-[var(--color-muted)] hover:text-red-400 transition-colors"
                          >
                            {t('comments.delete')}
                          </button>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>

          <Show when={hasMore()}>
            <button
              onClick={() => loadComments()}
              disabled={loading()}
              class="text-sm px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors disabled:opacity-40"
            >
              <Show when={loading()} fallback={t('comments.loadMore')}>
                {t('comments.loading')}
              </Show>
            </button>
          </Show>
        </Show>
      </Show>

      <Show
        when={authUser()}
        fallback={
          <p class="text-sm text-[var(--color-muted)]">{t('comments.loginToComment')}</p>
        }
      >
        <div class="flex flex-col gap-2 p-3 rounded-lg border border-[var(--color-border)] bg-white/40 dark:bg-white/5">
          <textarea
            value={body()}
            onInput={(e) => setBody(e.currentTarget.value)}
            placeholder={t('comments.placeholder')}
            maxLength="2000"
            rows="3"
            class="w-full text-sm p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] resize-y focus:outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-muted)]"
          />
          <div class="flex items-center justify-between">
            <Show when={showCounter()}>
              <span class={`text-xs ${remainingChars() < 0 ? 'text-red-400' : 'text-[var(--color-muted)]'}`}>
                {t('comments.charsLeft', { n: remainingChars() })}
              </span>
            </Show>
            <button
              onClick={handleSubmit}
              disabled={submitting() || body().trim().length === 0}
              class="ml-auto text-sm px-4 py-1.5 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Show when={submitting()} fallback={t('comments.publish')}>
                {t('comments.publishing')}
              </Show>
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default TuneComments;
