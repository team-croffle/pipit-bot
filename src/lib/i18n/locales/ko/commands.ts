/**
 * Slash commands in Korean — keyed by the English description or choice name, so a
 * command file states its words once, in English, and the registration adds these
 * (discord/slash.ts). A missing entry simply shows English.
 */
export const commandText: Record<string, string> = {
  // descriptions
  'List the commands': '명령 목록을 봅니다',
  'Check that the bot answers, and its gateway latency':
    '봇이 응답하는지와 게이트웨이 지연을 확인합니다',
  'Remind whoever a pull request or issue is waiting on':
    'PR이나 이슈가 기다리는 사람에게 다시 알립니다',
  'owner/repo #12, repo #12, or a pull request or issue link':
    'owner/repo #12, repo #12, 또는 PR·이슈 링크',
  'Go back to the previous track; the current one returns to the front of the queue':
    '이전 곡으로 돌아갑니다. 지금 곡은 대기열 맨 앞으로 갑니다',
  'Clear the queue': '대기열을 비웁니다',
  'Join your voice channel, or move there': '내 음성 채널에 들어오거나 그리로 옮깁니다',
  'Leave the voice channel and stop playback': '음성 채널에서 나가고 재생을 멈춥니다',
  'Set the repeat mode': '반복 방식을 정합니다',
  'What to repeat': '무엇을 반복할지',
  'Move a queued track to another position': '대기열의 곡을 다른 자리로 옮깁니다',
  'Current position': '지금 자리',
  'New position': '새 자리',
  'Set the playback options, or show them': '재생 옵션을 바꾸거나 봅니다',
  'Mix left and right into both ears, for one earphone': '좌우를 섞어 양쪽 귀에 — 이어폰 한쪽용',
  'Keep playing similar tracks when the queue runs out': '대기열이 끝나면 비슷한 곡을 이어서 재생',
  'The repeat mode a new session starts with': '새 세션이 시작할 때의 반복 방식',
  'Pause the current track': '지금 곡을 일시정지합니다',
  'The playlist': '재생목록',
  'Playlists: list, show, make, change and play them': '재생목록: 보기, 만들기, 바꾸기, 재생',
  'Shared playlists and your own': '공유 재생목록과 내 재생목록',
  'The tracks of a playlist': '재생목록의 곡',
  'Make a playlist': '재생목록을 만듭니다',
  'Its name': '이름',
  'Only for you (default: shared, anyone can edit)': '나만 쓰기(기본: 공유 — 누구나 편집)',
  'Rename a playlist': '재생목록 이름을 바꿉니다',
  'The new name': '새 이름',
  'Delete a playlist': '재생목록을 지웁니다',
  'Save tracks to a playlist': '재생목록에 곡을 담습니다',
  'What to save': '무엇을 담을지',
  'The song title or link, for "a song title or a link"':
    '"곡 제목이나 링크"를 고르면 그 제목이나 링크',
  'Remove a track': '곡을 뺍니다',
  'Its number in /playlist show': '/playlist show의 번호',
  'Move a track': '곡을 옮깁니다',
  'Its number now': '지금 번호',
  'Its new number': '새 번호',
  'Import tracks from a link the music worker can expand':
    'music worker가 펼칠 수 있는 링크에서 곡을 가져옵니다',
  'The link': '링크',
  'An existing playlist (default: a new one)': '기존 재생목록(기본: 새로 만듦)',
  'A new playlist only for you': '나만 쓰는 새 재생목록',
  'Play a playlist after the queue': '대기열 뒤에 재생목록을 재생합니다',
  'In random order': '무작위 순서로',
  'Play a song title or a link in your voice channel':
    '곡 제목이나 링크를 내 음성 채널에서 재생합니다',
  'A song title or a link': '곡 제목이나 링크',
  'Play it right after the current track': '지금 곡 바로 다음에 재생',
  'Show the current track and the queue': '지금 곡과 대기열을 봅니다',
  'Show your own music recap (only you see it)': '내 음악 결산을 봅니다(나만 보임)',
  'Which period (this month by default)': '어느 기간(기본: 이번 달)',
  'Remove a track from the queue': '대기열에서 곡을 뺍니다',
  'Queue position, as /queue shows it': '/queue에 보이는 대기열 번호',
  'Resume the paused track': '일시정지한 곡을 다시 재생합니다',
  'Search for a track and pick one of up to five results':
    '곡을 검색해 결과 다섯 개 중에서 고릅니다',
  'What to search for': '검색어',
  'Shuffle the queued tracks once': '대기열을 한 번 섞습니다',
  'Skip the current track, or skip to a queued one':
    '지금 곡을 건너뛰거나 대기열의 곡으로 건너뜁니다',
  'Skip to this queue position; the tracks before it are dropped':
    '이 대기열 번호로 — 그 앞의 곡은 빠집니다',
  'Stop playback and clear the queue': '재생을 멈추고 대기열을 비웁니다',
  'Set the volume, or show it': '볼륨을 바꾸거나 봅니다',
  '0–200; 100 is as prepared, above it is a boost': '0–200. 100이 준비된 그대로, 넘으면 증폭',
  // choices
  off: '끔',
  on: '켬',
  track: '한 곡',
  queue: '대기열',
  'the current track': '지금 곡',
  'the whole queue': '대기열 전체',
  'a song title or a link': '곡 제목이나 링크',
};
