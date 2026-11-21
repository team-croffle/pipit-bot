/** Pages that hold a place for a planned feature. */
export const planned = {
  calendar: {
    title: 'Calendar integration',
    description: 'Reads a Google Calendar and announces events and birthdays',
    points: [
      'Asks only for read access to the team calendar',
      'Birthday notices',
      'Reminders before meetings start',
      "Notices for product releases and the team's own events",
    ],
  },
  polls: {
    title: 'Polls',
    description: 'Connects the croffle-polls opinion-gathering system',
    points: [
      'Create polls from the dashboard and Discord',
      'Anonymous polls',
      'See the progress and results of open polls',
      'Settled together with the croffle scheduling system integration (v0.10.1)',
    ],
  },
};
