/**
 * YOUR CALENDAR. This file is the single source of truth for all content.
 *
 * Every personal detail is currently a visible placeholder such as [NAME] or
 * [YOUR MEMORY]. Replace the placeholders with your real texts, put photos in
 * public/media/photos/ and voice recordings in public/media/audio/, and run
 * `npm run content:validate` to check everything.
 *
 * IMPORTANT: everything in this file and in public/media/ is part of the
 * public, static website after deployment. Anyone with the URL can read it.
 * Only put things here that you are comfortable shipping that way.
 *
 * Text rules: standard German, "ss" instead of the sharp s, plain text with
 * optional **bold** and *italic*. Dates in `date` fields use YYYY-MM-DD and
 * are shown as DD.MM.YYYY.
 */
import { defineCalendar } from './schema.ts';

export default defineCalendar({
  calendarId: 'advent-2026',
  year: 2026,
  settings: {
    recipientName: '[NAME]',
    senderName: '[YOUR NAME]',
    title: '24 kleine Gründe, warum du mir wichtig bist',
    greeting: 'Hallo [NAME]',
    intro:
      'In diesem kleinen Dorf wartet jeden Tag im Dezember ein neues Türchen auf dich. Jedes erzählt ein bisschen davon, warum du mir so wichtig bist.',
    signature: 'Von Herzen, [YOUR NAME]',
    closingMessage:
      'Die Adventszeit ist vorbei, aber die Türchen, die du geöffnet hast, bleiben hier für dich. Danke, dass du dir jeden Tag einen Moment dafür genommen hast. [YOUR CLOSING NOTE]',
    footerNote: 'Gemacht mit viel Liebe und etwas zu viel Zimt.',
  },
  doors: [
    {
      day: 1,
      title: 'Willkommen im Dorf',
      blocks: [
        {
          type: 'letter',
          title: 'Liebe [NAME]',
          paragraphs: [
            'heute öffnet sich das erste Türchen. Ich habe mir überlegt, wie ich dir in diesem Dezember jeden Tag eine kleine Freude machen kann, und daraus ist dieses Dorf entstanden.',
            'Hinter jedem Türchen steckt etwas, das ich dir schon lange sagen wollte, eine Erinnerung oder eine kleine Einladung. [YOUR WELCOME MESSAGE]',
            'Jeden Tag kommt genau ein neues Türchen dazu. Die geöffneten bleiben hier, so oft du sie wieder lesen möchtest.',
          ],
          signature: '[YOUR NAME]',
        },
      ],
    },
    {
      day: 2,
      title: 'Etwas, das ich an dir schätze',
      blocks: [
        {
          type: 'letter',
          paragraphs: [
            'Mir ist neulich wieder aufgefallen, wie du [YOUR OBSERVATION].',
            'Das ist so eine Kleinigkeit, die vielleicht niemand sonst bemerkt. Ich schon. Und ich mag sie *sehr*.',
          ],
        },
      ],
    },
    {
      day: 3,
      title: 'Ein Lied für uns',
      blocks: [
        {
          type: 'song',
          trackTitle: '[SONGTITEL]',
          artist: '[INTERPRET]',
          spotifyUrl: '[SPOTIFY TRACK URL]',
          artwork: { src: '/media/photos/placeholder-record.svg', alt: '[PRIVATE PHOTO] Beispielbild: eine Schallplatte im Schnee' },
          intro: ['Dieses Lied läuft bei mir in letzter Zeit ziemlich oft.'],
          whyItRemindsUs: [
            '[YOUR MEMORY] Erzähl hier, wann ihr das Lied zum ersten Mal zusammen gehört habt und was es für dich bedeutet.',
          ],
        },
      ],
    },
    {
      day: 4,
      title: 'Ein gemeinsamer Moment',
      blocks: [
        {
          type: 'memory',
          title: '[TITEL DER ERINNERUNG]',
          photos: [{ src: '/media/photos/placeholder-winter-walk.svg', alt: '[PRIVATE PHOTO] Beispielbild: zwei Spuren im Schnee' }],
          date: '2025-01-18',
          location: '[ORT]',
          story: [
            '[YOUR MEMORY] Beschreibe, was an diesem Tag passiert ist.',
            'Und vor allem: warum dieser Moment für dich wichtig ist.',
          ],
        },
      ],
    },
    {
      day: 5,
      title: 'Ein kleiner Gutschein',
      blocks: [
        {
          type: 'voucher',
          title: 'Ein Abend, den du dir aussuchst.',
          description: 'Du entscheidest, was wir machen. Ich kümmere mich um den Rest.',
          conditions: ['Einlösbar an einem Abend deiner Wahl', 'Kein Widerspruch meinerseits erlaubt'],
          note: '[YOUR PERSONAL NOTE]',
        },
      ],
    },
    {
      // Door 6: the Samichlaus mission. The `blocks` below are the reward and
      // stay hidden in the interface until the game has been finished once.
      day: 6,
      title: 'Eine kleine Mission',
      game: {
        intro: [
          'Heute wartet eine kleine Mission auf dich. Hilf dem Samichlaus durch den verschneiten Winterwald.',
          'Am Ziel wartet eine Nachricht nur für dich.',
        ],
        startLabel: 'Mission starten',
        victoryText:
          'Du hast es geschafft! Der Samichlaus hat seine Lieferung abgegeben. Diese kleine Nachricht ist nur für dich.',
      },
      blocks: [
        {
          type: 'letter',
          title: 'Du hast es geschafft',
          paragraphs: [
            '[YOUR GAME REWARD MESSAGE] Hier steht die Nachricht, die der Samichlaus für sie ausgetragen hat. Zum Beispiel: warum sie dich an den echten Grund für dieses Spiel erinnert, oder eine kleine Ankündigung für den 6. Dezember.',
            'Danke, dass du dem Samichlaus geholfen hast.',
          ],
          signature: '[YOUR NAME]',
        },
        {
          type: 'voucher',
          title: 'Ein Samichlaus-Säckli, von mir gepackt.',
          description: 'Mandarinen, Nüsse, Schokolade und eine Überraschung. Abholbereit bei mir.',
          note: '[YOUR PERSONAL NOTE]',
        },
      ],
    },
    {
      day: 7,
      title: 'Drei kleine Gründe',
      blocks: [
        {
          type: 'reasons',
          title: 'Drei Dinge, die meinen Tag besser machen',
          intro: 'Ganz unspektakulär und gerade deshalb wichtig:',
          reasons: ['[REASON 1]', '[REASON 2]', '[REASON 3]'],
        },
      ],
    },
    {
      day: 8,
      title: 'Winterluft',
      blocks: [
        {
          type: 'activity',
          title: 'Eine kleine Winteraufgabe',
          invitation: [
            'Wenn du heute rausgehst: Mach ein Foto von etwas Winterlichem, das dich zum Lächeln bringt.',
            'Du musst es niemandem zeigen. Aber ich würde mich freuen.',
          ],
          ideas: ['Eisblumen an einem Fenster', 'Ein Licht in der Dämmerung', 'Deine Spuren im Schnee'],
        },
      ],
    },
    {
      day: 9,
      title: 'Noch ein Lied',
      blocks: [
        {
          type: 'song',
          trackTitle: '[SONGTITEL]',
          artist: '[INTERPRET]',
          spotifyUrl: '[SPOTIFY TRACK URL]',
          whyItRemindsUs: ['[YOUR MEMORY] Warum dich dieses Lied an euch erinnert.'],
        },
      ],
    },
    {
      day: 10,
      title: 'Weisst du noch?',
      blocks: [
        {
          type: 'memory',
          title: 'Der Moment, in dem wir nicht mehr aufhören konnten zu lachen',
          photos: [{ src: '/media/photos/placeholder-window.svg', alt: '[PRIVATE PHOTO] Beispielbild: ein erleuchtetes Fenster' }],
          dateLabel: '[WANN WAR DAS?]',
          story: ['[YOUR FUNNY MEMORY] Erzähl die Geschichte so, wie ihr sie euch heute noch erzählt.'],
        },
      ],
    },
    {
      day: 11,
      title: 'Ein Bild und seine Geschichte',
      blocks: [
        {
          type: 'memory',
          photos: [
            {
              src: '/media/photos/placeholder-market.svg',
              alt: '[PRIVATE PHOTO] Beispielbild: Lichter auf einem Weihnachtsmarkt',
              caption: '[BILDUNTERSCHRIFT]',
            },
          ],
          location: '[ORT]',
          story: ['[YOUR MEMORY] Eine kurze Geschichte zu diesem Bild.'],
        },
      ],
    },
    {
      day: 12,
      title: 'Eine Einladung',
      blocks: [
        {
          type: 'activity',
          title: 'Ein gemütlicher Abend',
          invitation: [
            'Ich lade dich zu einem Abend ein, an dem wir nichts müssen. Decke, Kerzen, etwas Warmes zu trinken.',
            'Du bringst nur dich mit.',
          ],
          ideas: ['Ein Film, den du aussuchst', 'Ein Spiel, bei dem ich vermutlich verliere', '[YOUR IDEA]'],
          note: 'Sag mir einfach, wann es dir passt.',
        },
      ],
    },
    {
      day: 13,
      title: 'Eine Nachricht zum Anhören',
      blocks: [
        {
          type: 'voice',
          title: 'Für dich aufgenommen',
          intro: ['Heute gibt es etwas zum Anhören. Am schönsten mit einer Tasse Tee.'],
          audio: { src: '/media/audio/placeholder-voice.wav' },
          durationLabel: '0:03',
          transcript: ['[TRANSCRIPT] Hier steht später, was in der Sprachnachricht gesagt wird.'],
        },
      ],
    },
    {
      day: 14,
      title: 'Eine Playlist für dich',
      blocks: [
        {
          type: 'playlist',
          title: '[PLAYLIST-NAME]',
          spotifyUrl: '[SPOTIFY PLAYLIST URL]',
          intro: ['Ich habe ein paar Lieder gesammelt, die mich an dich denken lassen.'],
          highlights: [
            { trackTitle: '[SONGTITEL]', artist: '[INTERPRET]', note: '[WARUM DIESES LIED?]' },
            { trackTitle: '[SONGTITEL]', artist: '[INTERPRET]' },
          ],
        },
      ],
    },
    {
      day: 15,
      title: 'Ein Gutschein für dich',
      blocks: [
        {
          type: 'voucher',
          title: 'Ein Frühstück, das ich für dich vorbereite.',
          description: 'Mit allem, was du magst, und ohne dass du früh aufstehen musst.',
          note: '[YOUR PERSONAL NOTE]',
        },
      ],
    },
    {
      day: 16,
      title: 'Ein Wunsch für später',
      blocks: [
        {
          type: 'letter',
          title: 'Irgendwann möchte ich mit dir …',
          paragraphs: ['[YOUR FUTURE PLAN] Ein Ort, eine Reise oder etwas ganz Kleines, das du mit ihr erleben möchtest.'],
        },
      ],
    },
    {
      day: 17,
      title: 'Das Lied von damals',
      blocks: [
        {
          type: 'song',
          trackTitle: '[SONGTITEL]',
          artist: '[INTERPRET]',
          spotifyUrl: '[SPOTIFY TRACK URL]',
          intro: ['Dieses Lied gehört für mich zu einem ganz bestimmten Moment.'],
          whyItRemindsUs: ['[YOUR MEMORY] Welcher Moment ist das?'],
        },
      ],
    },
    {
      day: 18,
      title: 'Ein kurzer Brief',
      blocks: [
        {
          type: 'letter',
          paragraphs: ['[YOUR SHORT LETTER]'],
          signature: '[YOUR NAME]',
        },
      ],
    },
    {
      day: 19,
      title: 'Eine kleine Herausforderung',
      blocks: [
        {
          type: 'activity',
          title: 'Wer findet das schönste Licht?',
          invitation: [
            'Heute suchen wir beide unabhängig voneinander das schönste Weihnachtslicht in unserer Umgebung.',
            'Am Abend vergleichen wir. Es gibt keinen Preis, nur Bewunderung.',
          ],
        },
      ],
    },
    {
      day: 20,
      title: 'Eine Lieblingserinnerung',
      blocks: [
        {
          type: 'memory',
          photos: [
            { src: '/media/photos/placeholder-cocoa.svg', alt: '[PRIVATE PHOTO] Beispielbild: zwei Tassen heisse Schokolade' },
            { src: '/media/photos/placeholder-winter-walk.svg', alt: '[PRIVATE PHOTO] Beispielbild: ein verschneiter Weg' },
          ],
          date: '2024-12-21',
          location: '[ORT]',
          story: ['[YOUR FAVOURITE MEMORY]'],
        },
      ],
    },
    {
      day: 21,
      title: 'Worauf ich mich freue',
      blocks: [
        {
          type: 'reasons',
          title: 'Dinge, auf die ich mich mit dir freue',
          reasons: ['[THING 1]', '[THING 2]', '[THING 3]', '[THING 4]'],
        },
        {
          type: 'voucher',
          title: 'Ein Spaziergang mit heisser Schokolade.',
          description: 'Wann immer du Lust hast. Die Schokolade bringe ich mit.',
        },
      ],
    },
    {
      day: 22,
      title: 'Ein Brief mit Bild',
      blocks: [
        {
          type: 'letter',
          paragraphs: ['[YOUR PHOTO LETTER] Ein paar Zeilen zu dem Bild unten.'],
        },
        {
          type: 'memory',
          photos: [{ src: '/media/photos/placeholder-window.svg', alt: '[PRIVATE PHOTO] Beispielbild: Kerzenlicht am Fenster' }],
          story: ['[YOUR MEMORY]'],
        },
      ],
    },
    {
      day: 23,
      title: 'Morgen ist es so weit',
      blocks: [
        {
          type: 'letter',
          paragraphs: [
            'Nur noch einmal schlafen. Das letzte Türchen ist das grösste im Dorf.',
            '[YOUR ANTICIPATION NOTE]',
          ],
        },
      ],
    },
    {
      day: 24,
      title: 'Das letzte Türchen',
      blocks: [
        {
          type: 'finalLetter',
          title: 'Liebe [NAME]',
          paragraphs: [
            '[YOUR FINAL LETTER] Hier ist Platz für einen längeren Brief.',
            'Danke für jeden Tag in diesem Dezember, an dem du ein Türchen geöffnet hast.',
          ],
          photo: { src: '/media/photos/placeholder-stars.svg', alt: '[PRIVATE PHOTO] Beispielbild: ein Sternenhimmel über dem Dorf' },
          finalSurprise: {
            title: 'Und noch etwas',
            paragraphs: ['[YOUR FINAL SURPRISE]'],
          },
          signature: '[YOUR NAME]',
        },
      ],
    },
  ],
});
