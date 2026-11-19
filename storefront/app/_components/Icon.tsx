const shapes = {
  pencil: 'm15 5 4 4 M4 16 16 4a2.8 2.8 0 0 1 4 4L8 20l-5 1z',
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  team: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 4a4 4 0 0 1 0 7 M20 21v-2a4 4 0 0 0-3-4',
  scan: 'M3 9V4h5 M16 4h5v5 M21 15v5h-5 M8 20H3v-5 M6 12h12',
  chat: 'M21 11a8 8 0 0 1-8 8H7l-5 3 1.8-6A8 8 0 0 1 11 3h2a8 8 0 0 1 8 8Z M7 10h9 M7 14h6',
  close: 'm6 6 12 12 M18 6 6 18',
  send: 'm3 4 18 8-18 8 3-8-3-8Z M6 12h13',
  store:
    'm3 9 2-5h14l2 5 M3 9q1 5 5 1 3 4 5 0 3 4 5 0 2 2 3-1 M5 13v7h14v-7 M9 20v-5h5v5',
  ticket: 'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z M15 6v2m0 3v2m0 3v2',
  link: 'm9 15 6-6 M9 8l2-2a4 4 0 0 1 6 6l-2 2 M15 16l-2 2a4 4 0 0 1-6-6l2-2',
  check: 'm4 12 5 5L20 6',
  stack: 'm3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  globe:
    'M22 12a10 10 0 1 1-20 0 10 10 0 1 1 20 0 M2 12h20 M12 2q-8 10 0 20 8-10 0-20',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
} as const
export default function Icon({
  name,
  size = 19,
}: {
  name: keyof typeof shapes
  size?: number
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={shapes[name]} />
    </svg>
  )
}
