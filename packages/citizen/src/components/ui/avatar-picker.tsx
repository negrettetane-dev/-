import React, { useId } from 'react';

export const DEFAULT_AVATAR = 'avatar-coral';

const AVATARS = [
  { id: 'avatar-coral', label: '温柔', colors: ['#ff3f82', '#ffc361'], rotation: 219 },
  { id: 'avatar-orange', label: '安静', colors: ['#09060f', '#ff7d10'], rotation: 55 },
  { id: 'avatar-pink', label: '活泼', colors: ['#ff005b', '#ff005b'], rotation: 0 },
  { id: 'avatar-mint', label: '元气', colors: ['#a3ffc7', '#efffae'], rotation: 219 },
] as const;

interface AvatarIconProps {
  avatar?: string;
  size?: number;
}

export const AvatarIcon: React.FC<AvatarIconProps> = ({ avatar = DEFAULT_AVATAR, size = 40 }) => {
  const option = AVATARS.find(item => item.id === avatar) ?? AVATARS[0];
  const maskId = useId();

  return (
    <svg viewBox="0 0 36 36" width={size} height={size} role="img" aria-label="用户头像">
      <mask id={maskId}>
        <rect width="36" height="36" rx="18" fill="#fff" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <rect width="36" height="36" fill={option.colors[0]} />
        {option.id !== 'avatar-orange' && option.id !== 'avatar-pink' && (
          <rect width="36" height="36" rx="7" fill={option.colors[1]} transform={`translate(7 -4) rotate(${option.rotation} 18 18)`} />
        )}
        {option.id === 'avatar-coral' && (
          <>
            <circle cx="13" cy="15" r="1" fill="#17111d" />
            <circle cx="23" cy="15" r="1" fill="#17111d" />
            <path d="M15 20.5c2 1.5 4 1.5 6 0" fill="none" stroke="#17111d" strokeLinecap="round" />
          </>
        )}
        {option.id === 'avatar-orange' && (
          <>
            <path d="M0 8C3 3 7 1 12 0C7 4 3 8 0 13Z" fill="#ff9b2f" />
            <path d="M0 28C2 31 5 34 9 36C5 31 2 26 0 22Z" fill="#ff9b2f" />
            <ellipse cx="15" cy="14.5" rx="1" ry="1.35" fill="#fff" />
            <ellipse cx="23" cy="14" rx="1" ry="1.35" fill="#fff" />
            <path d="M15 20c2.4 1.8 5.2 1.8 7.6-.2" fill="none" stroke="#fff" strokeWidth="1.25" strokeLinecap="round" />
          </>
        )}
        {option.id === 'avatar-pink' && (
          <>
            <ellipse cx="13.5" cy="14.5" rx="1" ry="1.35" fill="#fff" />
            <ellipse cx="22.5" cy="15.5" rx="1" ry="1.35" fill="#fff" />
            <path d="M13 20.2L23.5 21C22.3 24.2 20.1 25.8 17.8 25.6C15.6 25.4 13.8 23.5 13 20.2Z" fill="#fff" />
          </>
        )}
        {option.id === 'avatar-mint' && (
          <>
            <circle cx="13" cy="14" r="1" fill="#17111d" />
            <circle cx="23" cy="14" r="1" fill="#17111d" />
            <path d="M14 20c2.5 2 5.5 2 8 0" fill="none" stroke="#17111d" strokeLinecap="round" />
            <circle cx="10" cy="18" r="1.4" fill="#ff8fa8" opacity=".6" />
            <circle cx="26" cy="18" r="1.4" fill="#ff8fa8" opacity=".6" />
          </>
        )}
      </g>
    </svg>
  );
};

interface AvatarPickerProps {
  value?: string;
  onChange: (avatar: string) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ value = DEFAULT_AVATAR, onChange }) => (
  <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="选择头像">
    {AVATARS.map((avatar, index) => {
      const selected = value === avatar.id;
      return (
        <button
          key={avatar.id}
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={`选择${avatar.label}性格头像 ${index + 1}`}
          onClick={() => onChange(avatar.id)}
          className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-white p-1 transition duration-200 hover:-translate-y-0.5 ${selected ? 'border-[#ff8eaa] shadow-[0_0_0_3px_#ffe5ec]' : 'border-[#f3dbe2]'}`}
        >
          <AvatarIcon avatar={avatar.id} size={44} />
        </button>
      );
    })}
  </div>
);
