import React, { useState } from 'react';
import {
  MessageSquare,
  Code2,
  Building2,
  LogOut,
  Volume2,
  VolumeX,
  Bell,
  Menu
} from 'lucide-react';
import { Property, User } from '../types';
import { soundFx } from '../utils/audio';

interface HeaderProps {
  properties: Property[];
  selectedProperty: Property;
  onSelectProperty: (p: Property) => void;
  currentUser: User;
  users: User[];
  onSelectUser: (u: User) => void;
  onUpdateUserStatus?: (userId: string, status: 'online' | 'away' | 'offline') => void;
  onOpenEmbedModal: () => void;
  isAudioMuted?: boolean;
  onToggleAudioMute?: () => void;
  onLogout?: () => void;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  properties,
  selectedProperty,
  onSelectProperty,
  currentUser,
  users,
  onSelectUser,
  onUpdateUserStatus,
  onOpenEmbedModal,
  isAudioMuted = false,
  onToggleAudioMute,
  onLogout,
  onOpenMobileMenu
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md shrink-0">
      {/* Top Bar: Property & Role controls */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger to open the nav drawer */}
          {onOpenMobileMenu && (
            <button
              onClick={onOpenMobileMenu}
              className="md:hidden text-slate-300 hover:text-white p-1.5 -ml-1.5 rounded-md hover:bg-slate-800"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2 font-bold text-lg text-blue-400">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-inner">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="hidden sm:inline">AA Creative Embroidery AI Platform</span>
            <span className="sm:hidden">AA Creative EMB</span>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-800">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={selectedProperty.id}
              onChange={e => {
                const found = properties.find(p => p.id === e.target.value);
                if (found) onSelectProperty(found);
              }}
              className="bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sound Ding Alert Toggle & Test button */}
          <button
            onClick={() => soundFx.playDing('visitor')}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-md text-xs font-medium transition shadow-xs"
            title="Play 1-Second Ding Tone for Visitor Alert"
          >
            <Bell className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">1s Ding Sound</span>
          </button>

          {/* Mute / Unmute all chat notification sounds */}
          {onToggleAudioMute && (
            <button
              onClick={onToggleAudioMute}
              className={`flex items-center gap-1.5 border px-2.5 py-1.5 rounded-md text-xs font-medium transition shadow-xs ${
                isAudioMuted
                  ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border-rose-800'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title={isAudioMuted ? 'Unmute chat notification sounds' : 'Mute chat notification sounds'}
            >
              {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="hidden sm:inline">{isAudioMuted ? 'Muted' : 'Sound On'}</span>
            </button>
          )}

          {/* Embed snippet button */}
          <button
            onClick={onOpenEmbedModal}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition shadow"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Get Embed Script</span>
          </button>

          {/* User / Agent switcher with direct Status Toggle */}
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-5 h-5 rounded-full object-cover"
            />
            <select
              value={currentUser.id}
              onChange={e => {
                const found = users.find(u => u.id === e.target.value);
                if (found) onSelectUser(found);
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none max-w-[140px] truncate"
            >
              {users.map(u => (
                <option key={u.id} value={u.id} className="bg-slate-800 text-slate-200">
                  {u.name} ({u.role.toUpperCase()})
                </option>
              ))}
            </select>

            {/* Status Selector Dropdown */}
            {onUpdateUserStatus ? (
              <select
                value={currentUser.status}
                onChange={e => onUpdateUserStatus(currentUser.id, e.target.value as any)}
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded focus:outline-none cursor-pointer border ${
                  currentUser.status === 'online'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : currentUser.status === 'away'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                    : 'bg-slate-950/80 text-slate-400 border-slate-700'
                }`}
              >
                <option value="online" className="bg-slate-800 text-emerald-400">🟢 Online</option>
                <option value="away" className="bg-slate-800 text-amber-400">🟡 Away</option>
                <option value="offline" className="bg-slate-800 text-slate-400">⚪ Offline</option>
              </select>
            ) : (
              <span
                className={`w-2 h-2 rounded-full ${
                  currentUser.status === 'online'
                    ? 'bg-emerald-400 animate-pulse'
                    : currentUser.status === 'away'
                    ? 'bg-amber-400'
                    : 'bg-slate-500'
                }`}
                title={`Agent status: ${currentUser.status}`}
              />
            )}
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign Out Admin Portal"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-rose-900/60 border border-slate-700 hover:border-rose-700/60 rounded-md transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
