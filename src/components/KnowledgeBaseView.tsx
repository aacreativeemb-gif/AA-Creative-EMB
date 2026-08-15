import React, { useState } from 'react';
import { BookOpen, Search, Plus, ThumbsUp, Eye, Tag, FileText } from 'lucide-react';
import { KbArticle, KbCategory } from '../types';

interface KnowledgeBaseViewProps {
  articles: KbArticle[];
  categories: KbCategory[];
  onCreateArticle: (title: string, content: string, categoryId: string, tags: string[]) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  articles,
  categories,
  onCreateArticle
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat_shipping');
  const [tagsText, setTagsText] = useState('shipping, delivery');

  const filteredArticles = articles.filter(a => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
    onCreateArticle(title, content, categoryId, tags);
    setShowModal(false);
    setTitle('');
    setContent('');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 uppercase tracking-wider">
            Public & AI Knowledge Base
          </span>
          <h2 className="text-xl font-bold text-slate-800 mt-2">Knowledge Base & FAQ Articles</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Knowledge base articles used both for self-service website help centers and AI Agent answer grounding.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
        >
          <Plus className="w-4 h-4" /> Add Article
        </button>
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredArticles.map(art => (
          <div key={art.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              {art.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">{art.content}</p>

            <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {art.views} Views</span>
                <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5 text-emerald-600" /> {art.helpfulCount} Helpful</span>
              </div>
              <div className="flex gap-1">
                {art.tags.map((t, i) => (
                  <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Add Knowledge Base Article</h3>
            
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Article Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Courier Shipping Timelines"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Content</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={4}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={tagsText}
                onChange={e => setTagsText(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-1/2 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg shadow"
              >
                Save Article
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
