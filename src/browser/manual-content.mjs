// Remaining gameplay chapters, checked visually against Ressources/Shadowrun.pdf.
// Page-by-page findings and source ambiguities: docs/manual-source-content.md.
// These editorial reference entries are independent of the game's rules and state.
const SOURCE_DOCUMENT = 'shadowrun-snes-us-manual';
export const MANUAL_EXTRA_SOURCES = {
  setting: { document: SOURCE_DOCUMENT, pdfPage: 3, manualPage: 1 },
  starting: { document: SOURCE_DOCUMENT, pdfPage: 5, manualPage: 3 },
  titleMenu: { document: SOURCE_DOCUMENT, pdfPage: 7, manualPage: 5 },
  soundOptions: { document: SOURCE_DOCUMENT, pdfPage: 8, manualPage: 6 },
  movement: { document: SOURCE_DOCUMENT, pdfPage: 9, manualPage: 7 },
  pointers: { document: SOURCE_DOCUMENT, pdfPage: 10, manualPage: 8 },
  actions: { document: SOURCE_DOCUMENT, pdfPage: 11, manualPage: 9 },
  trading: { document: SOURCE_DOCUMENT, pdfPage: 12, manualPage: 10 },
  status: { document: SOURCE_DOCUMENT, pdfPage: 13, manualPage: 11 },
  attributes: { document: SOURCE_DOCUMENT, pdfPage: 14, manualPage: 12 },
  selectedEquipment: { document: SOURCE_DOCUMENT, pdfPage: 15, manualPage: 13 },
  itemsAndMagic: { document: SOURCE_DOCUMENT, pdfPage: 16, manualPage: 14 },
  otherInventories: { document: SOURCE_DOCUMENT, pdfPage: 17, manualPage: 15 },
  runners: { document: SOURCE_DOCUMENT, pdfPage: 20, manualPage: 18 },
  hiring: { document: SOURCE_DOCUMENT, pdfPage: 21, manualPage: 19 },
  orders: { document: SOURCE_DOCUMENT, pdfPage: 22, manualPage: 20 },
  runnerCare: { document: SOURCE_DOCUMENT, pdfPage: 23, manualPage: 21 },
  party: { document: SOURCE_DOCUMENT, pdfPage: 24, manualPage: 22 },
  socialSkills: { document: SOURCE_DOCUMENT, pdfPage: 27, manualPage: 25 },
  technicalSkills: { document: SOURCE_DOCUMENT, pdfPage: 28, manualPage: 26 },
  resting: { document: SOURCE_DOCUMENT, pdfPage: 29, manualPage: 27 },
  karma: { document: SOURCE_DOCUMENT, pdfPage: 30, manualPage: 28 },
  conversations: { document: SOURCE_DOCUMENT, pdfPage: 31, manualPage: 29 },
  keywords: { document: SOURCE_DOCUMENT, pdfPage: 32, manualPage: 30 },
  vidphone: { document: SOURCE_DOCUMENT, pdfPage: 33, manualPage: 31 },
  matrixEquipment: { document: SOURCE_DOCUMENT, pdfPage: 34, manualPage: 32 },
  matrixLayout: { document: SOURCE_DOCUMENT, pdfPage: 35, manualPage: 33 },
  matrixCombat: { document: SOURCE_DOCUMENT, pdfPage: 36, manualPage: 34 },
  matrixData: { document: SOURCE_DOCUMENT, pdfPage: 37, manualPage: 35 },
  matrixExit: { document: SOURCE_DOCUMENT, pdfPage: 38, manualPage: 36 },
};

export const MANUAL_EXTRA_ARTICLES = [
  {
    id: 'seattle-2050',
    chapter: 'getting-started',
    source: MANUAL_EXTRA_SOURCES.setting,
    title: { en: 'Seattle, 2050', de: 'Seattle im Jahr 2050' },
    text: {
      en: 'Megacorporations dominate the city, while hired shadowrunners make their living on its streets. Cyberware and modern weapons coexist with magic, elves, orcs, dwarves and trolls. You play Jake Armitage, a runner with amnesia. Recovering his past means exploring, gathering information and finding allies whose loyalty cannot be taken for granted.',
      de: 'Megakonzerne beherrschen die Stadt, während angeheuerte Shadowrunner auf ihren Straßen ihr Geld verdienen. Cyberware und moderne Waffen existieren neben Magie, Elfen, Orks, Zwergen und Trollen. Du spielst Jake Armitage, einen Runner mit Gedächtnisverlust. Um seine Vergangenheit aufzudecken, musst du die Stadt erkunden, Informationen sammeln und Verbündete finden, deren Loyalität nicht selbstverständlich ist.',
    },
  },
  {
    id: 'starting-jake',
    chapter: 'getting-started',
    source: MANUAL_EXTRA_SOURCES.movement,
    title: { en: 'Your first steps', de: 'Deine ersten Schritte' },
    text: {
      en: 'Jake wakes in a drawer at the city morgue, disoriented and without his memories. Explore the room, examine objects and talk to people to find your way forward. The main game view is where you move, interact and fight. Pay attention to dialogue and the names that appear under the pointer; progress depends on information as well as firepower.',
      de: 'Jake erwacht verwirrt und ohne Erinnerung in einer Schublade der städtischen Leichenhalle. Erkunde den Raum, untersuche Gegenstände und sprich mit Menschen, um weiterzukommen. Im Hauptspielbild bewegst du dich, interagierst und kämpfst. Achte auf Dialoge und die Bezeichnungen unter dem Zeiger: Informationen sind ebenso wichtig wie Feuerkraft.',
    },
  },
  {
    id: 'title-story',
    chapter: 'getting-started',
    source: MANUAL_EXTRA_SOURCES.starting,
    title: { en: 'Title and background story', de: 'Titelbild und Vorgeschichte' },
    text: {
      en: 'At the title screen, wait to see the background story or press {Start} to reach the main game menu. Instructions show your current keyboard and mouse bindings from Options → Controls.',
      de: 'Warte am Titelbildschirm, um die Vorgeschichte anzusehen, oder drücke {Start} für das Hauptmenü. Die Anweisungen zeigen deine aktuelle Tastatur- und Mausbelegung aus Optionen → Steuerung.',
    },
  },
  {
    id: 'new-and-saved-game',
    chapter: 'getting-started',
    source: MANUAL_EXTRA_SOURCES.titleMenu,
    title: { en: 'New game or saved game', de: 'Neues Spiel oder Spielstand laden' },
    text: {
      en: 'Choose Start New Game and confirm with {Start} to begin. Credits is the fourth entry after Options. It plays the staff credits with music; {B} or {Start} returns to the start menu. To continue, choose Start Saved Game, then select an occupied slot and confirm with {B}. Empty slots are dimmed; occupied slots are highlighted. The normal game offers two slots. Browser options can enable four slots before a session begins.',
      de: 'Wähle ein neues Spiel und bestätige mit {Start}, um zu beginnen. Mitwirkende ist der vierte Eintrag nach Optionen. Er zeigt den Abspann mit Musik; {B} oder {Start} führt zurück ins Startmenü. Zum Fortsetzen wählst du den Start eines gespeicherten Spiels, anschließend einen belegten Platz und bestätigst mit {B}. Leere Plätze sind abgedunkelt, belegte hervorgehoben. Normalerweise gibt es zwei Plätze. Über die Browseroptionen lassen sich vor dem Spielstart vier aktivieren.',
    },
  },
  {
    id: 'original-options',
    chapter: 'getting-started',
    source: MANUAL_EXTRA_SOURCES.titleMenu,
    title: { en: 'In-game control types', de: 'Steuerungstypen im Spiel' },
    text: {
      en: 'The in-game Options menu includes Control Type A and B. Type A maps straight D-pad directions to diagonal movement on the isometric scene. Type B uses diagonal D-pad input for diagonal movement. These settings belong to the game; assigning keyboard keys and mouse buttons is done separately in the browser options.',
      de: 'Das Optionsmenü im Spiel bietet die Steuerungstypen A und B. Bei Typ A führen gerade Richtungen des Steuerkreuzes zu diagonalen Bewegungen in der isometrischen Szene. Bei Typ B entspricht eine diagonale Eingabe einer diagonalen Bewegung. Diese Einstellung gehört zum Spiel; Tastatur- und Maustasten ordnest du separat in den Browseroptionen zu.',
    },
  },
  {
    id: 'game-sound-options',
    chapter: 'getting-started',
    source: MANUAL_EXTRA_SOURCES.soundOptions,
    title: { en: 'In-game sound options', de: 'Tonoptionen im Spiel' },
    text: {
      en: 'The in-game sound menu offers Stereo or Mono. Background Music has three modes: Full plays music throughout, Event limits it to important events and certain conversations, and Off turns it off. Exit returns to the title screen. Options → Audio separately provides the Original/Tribute soundtrack choice, Tribute volume, the analog audio filter and explained audio profiles.',
      de: 'Das Tonmenü im Spiel bietet Stereo oder Mono. Für die Hintergrundmusik gibt es drei Modi: Full spielt durchgehend Musik, Event beschränkt sie auf wichtige Ereignisse und bestimmte Gespräche, Off schaltet sie ab. Exit führt zum Titelbild zurück. Unter Optionen → Audio findest du zusätzlich die Musikauswahl Original/Tribute, die Tribute-Lautstärke, den analogen Audiofilter und die Audioprofile mit Erklärungen.',
    },
  },
  {
    id: 'movement-and-tags',
    chapter: 'interface',
    source: MANUAL_EXTRA_SOURCES.movement,
    title: { en: 'Movement and target labels', de: 'Bewegung und Zielbezeichnungen' },
    text: {
      en: 'Use {Up}, {Down}, {Left} and {Right} to walk along streets, through doors, down stairs and into rooms. Position the action glove, spell glove or crosshair over a person or object until its tag appears at the lower right. This label identifies the selected target; an action or spell needs the correct target label to take effect.',
      de: 'Mit {Up}, {Down}, {Left} und {Right} gehst du durch Straßen und Türen, Treppen hinunter und in Räume. Positioniere Aktionshand, Zauberhand oder Fadenkreuz über einer Person oder einem Objekt, bis rechts unten dessen Bezeichnung erscheint. Sie zeigt das gewählte Ziel an. Eine Aktion oder ein Zauber benötigt die passende Zielbezeichnung, um zu wirken.',
    },
  },
  {
    id: 'three-pointers',
    chapter: 'interface',
    source: MANUAL_EXTRA_SOURCES.pointers,
    title: {
      en: 'Action glove, spell glove and crosshair',
      de: 'Aktionshand, Zauberhand und Fadenkreuz',
    },
    text: {
      en: '{B} brings up the yellow action glove for examining, talking, picking up and other interactions. {X} brings up the gray spell glove; another {X} casts the selected spell. If no spell is available or selected, dismiss the No Spell Selected message with {X}. {A} brings up the weapon crosshair. In the browser the mouse positions these pointers directly; movement keys close the action glove so Jake can walk.',
      de: '{B} öffnet die gelbe Aktionshand zum Untersuchen, Reden, Aufheben und für weitere Aktionen. {X} öffnet die graue Zauberhand; ein weiteres {X} wirkt den gewählten Zauber. Ist kein Zauber verfügbar oder ausgewählt, schließt {X} die entsprechende Meldung. {A} öffnet das Waffenfadenkreuz. Im Browser positioniert die Maus diese Zeiger direkt; die Bewegungstasten schließen die Aktionshand, damit Jake gehen kann.',
    },
  },
  {
    id: 'doors-and-keys',
    chapter: 'interface',
    source: MANUAL_EXTRA_SOURCES.actions,
    title: { en: 'Doors and locked entrances', de: 'Türen und verschlossene Zugänge' },
    text: {
      en: 'Point the action glove at a door until its tag appears, press {B} to open its action list and choose Open. {R} is a shortcut for opening a door. A locked door needs the correct key: choose that key in the item inventory and use it on the door.',
      de: 'Richte die Aktionshand auf eine Tür, bis ihre Bezeichnung erscheint. {B} öffnet die Aktionsliste; wähle Open zum Öffnen. {R} ist die Abkürzung für diese Aktion. Eine verschlossene Tür benötigt den richtigen Schlüssel: Wähle ihn im Gegenstandsinventar und benutze ihn an der Tür.',
    },
  },
  {
    id: 'items-and-nuyen',
    chapter: 'interface',
    source: MANUAL_EXTRA_SOURCES.actions,
    title: {
      en: 'Examine, pick up and collect nuyen',
      de: 'Untersuchen, aufheben und Nuyen sammeln',
    },
    text: {
      en: 'Use the action glove to identify an item, then select Examine or Pick Up from its action list. Items can be important to puzzles, so inspect what you find. Nuyen pays for equipment and hired help. Defeated enemies often leave money behind; collect it with the action glove rather than assuming it has already been added to your funds.',
      de: 'Wähle einen Gegenstand mit der Aktionshand und dann Examine zum Untersuchen oder Pick Up zum Aufheben. Gegenstände können für Rätsel wichtig sein; sieh dir deine Funde an. Mit Nuyen bezahlst du Ausrüstung und angeheuerte Hilfe. Besiegte Gegner hinterlassen häufig Geld. Sammle es mit der Aktionshand ein, statt davon auszugehen, dass es bereits deinem Guthaben gutgeschrieben wurde.',
    },
  },
  {
    id: 'buying-and-selling',
    chapter: 'interface',
    source: MANUAL_EXTRA_SOURCES.trading,
    title: { en: 'Buying and selling', de: 'Kaufen und verkaufen' },
    text: {
      en: 'Examine an item before buying it. Ask a seller about a relevant keyword to obtain an offer, then choose Yes to accept. To sell, select the item, choose Give and point at a potential buyer. If the person wants it, they offer a fixed amount; confirm Yes to sell. Not every person is a buyer, and not every conversation is just background: people provide essential clues.',
      de: 'Untersuche einen Gegenstand vor dem Kauf. Frage einen Verkäufer nach einem passenden Schlüsselwort, um ein Angebot zu erhalten, und bestätige es mit Yes. Zum Verkaufen wählst du den Gegenstand, dann Give und anschließend einen möglichen Käufer. Wenn die Person Interesse hat, nennt sie einen festen Betrag; Yes schließt den Verkauf ab. Nicht jede Person kauft Gegenstände. Gespräche liefern außerdem wichtige Hinweise.',
    },
  },
  {
    id: 'life-meter',
    chapter: 'interface',
    source: MANUAL_EXTRA_SOURCES.trading,
    title: { en: 'Life meter and Stamina', de: 'Lebensanzeige und Stamina' },
    text: {
      en: 'The meter at the upper right shows remaining Stamina. Its capacity depends on Body. Hits reduce Stamina; reaching zero means death. For exact current and maximum values, open Jake’s status with {Start} or party status with {Select}. Check these values before another fight instead of relying only on the meter.',
      de: 'Die Anzeige rechts oben zeigt deine verbleibenden Stamina-Punkte. Ihre Kapazität hängt von Body ab. Treffer verringern Stamina; bei null stirbt Jake. Genaue aktuelle und maximale Werte findest du mit {Start} in Jakes Status oder mit {Select} im Gruppenstatus. Prüfe sie vor einem weiteren Kampf, statt dich nur auf den Balken zu verlassen.',
    },
  },
  {
    id: 'status-screen',
    chapter: 'character',
    source: MANUAL_EXTRA_SOURCES.status,
    title: { en: 'Read Jake’s status', de: 'Jakes Status lesen' },
    text: {
      en: '{Start} opens the status screen. It shows attributes, Karma, money and the currently selected spell, weapon and armor. Choose an inventory category with the direction controls and confirm with {Start}; an empty category returns to Exit. Choose Exit or press {Select} to return to the game.',
      de: '{Start} öffnet den Statusbildschirm. Er zeigt Attribute, Karma, Geld sowie den gewählten Zauber, die Waffe und die Rüstung. Wähle mit den Richtungstasten eine Inventarkategorie und bestätige mit {Start}. Eine leere Kategorie führt zurück zu Exit. Mit Exit oder {Select} kehrst du zum Spiel zurück.',
    },
  },
  {
    id: 'body-and-stamina',
    chapter: 'character',
    source: MANUAL_EXTRA_SOURCES.status,
    title: { en: 'Body and Stamina', de: 'Body: Konstitution und Stamina' },
    text: {
      en: 'Body determines the maximum Stamina you can recover. Its listed range is 0–20 and Jake begins at level 3. For example, Body 7 allows up to 70 Stamina points. Stamina is your current health reserve, not an extra equipment requirement. Damage removes a varying number of points, so one hit is not necessarily one Stamina point.',
      de: 'Body bestimmt die maximale Stamina, die du wiederherstellen kannst. Der Wertebereich beträgt 0–20; Jake beginnt auf Stufe 3. Mit Body 7 kannst du beispielsweise bis zu 70 Stamina-Punkte haben. Stamina ist dein aktueller Lebensvorrat und keine zusätzliche Ausrüstungsvoraussetzung. Treffer ziehen unterschiedlich viele Punkte ab; ein Treffer entspricht also nicht unbedingt einem Stamina-Punkt.',
    },
  },
  {
    id: 'magic-attribute',
    chapter: 'character',
    source: MANUAL_EXTRA_SOURCES.attributes,
    title: { en: 'Magic and spell points', de: 'Magic: Magie und Zauberpunkte' },
    text: {
      en: 'Magic determines the maximum spell points you can recover. Its range is 0–20 and Jake starts at 0. For example, Magic 8 allows up to 80 spell points. Learning a spell does not remove its casting cost: you still need enough spell points each time you use it.',
      de: 'Magic bestimmt die maximale Zahl wiederherstellbarer Zauberpunkte. Der Bereich beträgt 0–20; Jake beginnt bei 0. Mit Magic 8 sind beispielsweise bis zu 80 Zauberpunkte möglich. Einen Zauber zu kennen hebt seine Kosten nicht auf: Bei jeder Anwendung brauchst du genügend Zauberpunkte.',
    },
  },
  {
    id: 'strength-and-charisma',
    chapter: 'character',
    source: MANUAL_EXTRA_SOURCES.attributes,
    title: { en: 'Strength and Charisma', de: 'Strength und Charisma' },
    text: {
      en: 'Strength ranges up to 6 and decides which weapons and armor you can use; carrying an item is not the same as equipping it. Charisma ranges up to 6 and starts at 3. It controls how many shadowrunners can work for you at once. At Charisma 6, you can hire up to three companions.',
      de: 'Strength reicht bis 6 und entscheidet, welche Waffen und Rüstungen du benutzen kannst. Einen Gegenstand zu tragen bedeutet noch nicht, ihn ausgerüstet zu haben. Charisma reicht ebenfalls bis 6 und beginnt bei 3. Es bestimmt, wie viele Shadowrunner gleichzeitig für dich arbeiten können. Mit Charisma 6 kannst du bis zu drei Begleiter anheuern.',
    },
  },
  {
    id: 'karma-money-and-equipment',
    chapter: 'character',
    source: MANUAL_EXTRA_SOURCES.selectedEquipment,
    title: { en: 'Karma, money and selected equipment', de: 'Karma, Geld und gewählte Ausrüstung' },
    text: {
      en: 'Karma is the resource for improving attributes, skills and magic; nuyen is money for purchases and contracts. The Spell and Weapon lines show what is selected for use. The Armor line shows what you are wearing. Armor in the inventory provides no protection until you equip it.',
      de: 'Karma ist die Ressource zum Steigern von Attributen, Fertigkeiten und Magie. Nuyen ist dein Geld für Käufe und Verträge. Die Zeilen Spell und Weapon zeigen den gewählten Zauber und die gewählte Waffe. Armor zeigt die angelegte Rüstung. Eine Rüstung im Inventar schützt erst, wenn du sie ausrüstest.',
    },
  },
  {
    id: 'items-inventory',
    chapter: 'inventory',
    source: MANUAL_EXTRA_SOURCES.itemsAndMagic,
    title: {
      en: 'Items: Examine, Give and Use',
      de: 'Gegenstände: untersuchen, geben und benutzen',
    },
    text: {
      en: 'Items lists the objects you have collected. Select an entry to open its available actions: Examine gives information, Give hands it to a character, and Use applies it to a suitable target. Which actions appear depends on the item. Use this inventory for keys and other objects needed to solve puzzles.',
      de: 'Items listet deine gesammelten Gegenstände auf. Wähle einen Eintrag, um seine verfügbaren Aktionen zu öffnen: Examine liefert Informationen, Give übergibt ihn an eine Person und Use benutzt ihn an einem passenden Ziel. Welche Aktionen erscheinen, hängt vom Gegenstand ab. Hier verwendest du Schlüssel und andere Objekte zum Lösen von Rätseln.',
    },
  },
  {
    id: 'magic-inventory',
    chapter: 'inventory',
    source: MANUAL_EXTRA_SOURCES.itemsAndMagic,
    title: { en: 'Magic: choose your active spell', de: 'Magie: aktiven Zauber wählen' },
    text: {
      en: 'Magic lists your learned spells. Each entry shows its level and its spell-point cost in brackets. Choose a spell here to assign it to {X}. Improving a spell can change its effect or duration and its casting cost, so check the displayed cost after upgrading.',
      de: 'Magic listet deine gelernten Zauber auf. Bei jedem Eintrag stehen die Stufe und die Kosten in Zauberpunkten in Klammern. Hier wählst du den Zauber für {X}. Eine Steigerung kann Wirkung oder Dauer sowie die Kosten verändern. Prüfe deshalb nach einer Verbesserung die angezeigten Kosten.',
    },
  },
  {
    id: 'equipment-inventories',
    chapter: 'inventory',
    source: MANUAL_EXTRA_SOURCES.otherInventories,
    title: { en: 'Weapon and Armor inventories', de: 'Waffen- und Rüstungsinventar' },
    text: {
      en: 'Weapon lists the weapons you carry; Armor lists your armor. Select an item in the appropriate list to equip it, subject to its Strength requirement. The status screen confirms which item is actually in use. Replacing equipment does not mean the previous item is lost: it can be selected again from its inventory.',
      de: 'Weapon zeigt deine mitgeführten Waffen, Armor deine Rüstungen. Wähle im passenden Inventar einen Gegenstand zum Ausrüsten; dafür musst du seine Stärkevoraussetzung erfüllen. Auf dem Statusbildschirm siehst du, was tatsächlich benutzt wird. Ausgetauschte Ausrüstung geht dadurch nicht verloren und lässt sich im Inventar wieder auswählen.',
    },
  },
  {
    id: 'skills-and-cyber-inventory',
    chapter: 'inventory',
    source: MANUAL_EXTRA_SOURCES.otherInventories,
    title: { en: 'Skills and Cyber inventories', de: 'Fertigkeits- und Cyberware-Inventar' },
    text: {
      en: 'Skills shows learned abilities and their levels. Skills work automatically once learned; selecting one here does not activate it. Improve them with Karma at a bed. Cyber lists fitted cyber equipment. It also works continuously after installation and is not switched on by selecting an inventory entry.',
      de: 'Skills zeigt gelernte Fertigkeiten und ihre Stufen. Sie wirken nach dem Erlernen automatisch; die Auswahl im Inventar aktiviert sie nicht. Steigern kannst du sie mit Karma an einem Bett. Cyber zeigt eingebaute Cyberausrüstung. Auch sie wirkt nach dem Einbau dauerhaft und wird nicht durch die Auswahl eines Inventareintrags eingeschaltet.',
    },
  },
  {
    id: 'innocent-people',
    chapter: 'combat',
    source: MANUAL_EXTRA_SOURCES.runners,
    title: { en: 'Choose your fights', de: 'Wähle deine Kämpfe' },
    text: {
      en: 'Firepower alone is not enough for every run; companions can make the difference. Keep attacks to combat situations. Shooting people who are not threatening you prompts a warning from your spirit guide. Continuing can cost one Karma point if you have any Karma.',
      de: 'Feuerkraft allein reicht nicht für jeden Run; Begleiter können entscheidend sein. Beschränke Angriffe auf Kampfsituationen. Wenn du Menschen beschießt, die dich nicht bedrohen, warnt dein Geistführer dich. Weitere Angriffe können einen Karma-Punkt kosten, sofern du Karma besitzt.',
    },
  },
  {
    id: 'runner-types',
    chapter: 'combat',
    source: MANUAL_EXTRA_SOURCES.runners,
    title: { en: 'Mercenaries, deckers and magic users', de: 'Söldner, Decker und Magieanwender' },
    text: {
      en: 'Mercenaries specialize in combat and usually bring weapons and armor. Deckers are useful for Matrix work and also generally carry a firearm and armor. Magic users rely on magical attacks, using Powerorbs by default, rather than commonly carrying guns. Their spell inventory and spell points also give your party access to magic.',
      de: 'Söldner sind auf Kämpfe spezialisiert und bringen meist Waffen und Rüstung mit. Decker helfen bei Matrixaufgaben und tragen gewöhnlich ebenfalls eine Schusswaffe und Rüstung. Magieanwender setzen auf magische Angriffe, standardmäßig Powerorbs, und tragen selten Schusswaffen. Ihr Zauberinventar und ihre Zauberpunkte eröffnen der Gruppe weitere magische Möglichkeiten.',
    },
  },
  {
    id: 'hiring-runners',
    chapter: 'combat',
    source: MANUAL_EXTRA_SOURCES.hiring,
    title: { en: 'Hire and retain companions', de: 'Begleiter anheuern und behalten' },
    text: {
      en: 'Talk to a shadowrunner and use the appropriate keywords to ask them to join. Hired runners follow you through most places, but may wait outside certain areas. A runner who has fulfilled the contract leaves and returns to the place where they were hired, where you can hire them again. Charisma limits party size; Leadership helps runners stay through more fights.',
      de: 'Sprich mit einem Shadowrunner und nutze die passenden Schlüsselwörter, um ihn anzuheuern. Begleiter folgen dir an die meisten Orte, warten vor bestimmten Bereichen aber draußen. Hat ein Runner seinen Vertrag erfüllt, geht er zu seinem ursprünglichen Aufenthaltsort zurück. Dort kannst du ihn erneut anheuern. Charisma begrenzt die Gruppengröße; Leadership hilft, Begleiter über mehr Kämpfe hinweg zu halten.',
    },
  },
  {
    id: 'runner-examine-and-talk',
    chapter: 'combat',
    source: MANUAL_EXTRA_SOURCES.hiring,
    title: { en: 'Inspect and talk to your runners', de: 'Begleiter untersuchen und ansprechen' },
    text: {
      en: 'In combat, runners spread out, choose positions and attack targets on their own. You can still intervene through their action lists. Point the action glove at a runner and press {B}. Examine opens their status so you can inspect attributes, equipment, Skills and Cyber. Talk starts a conversation with that companion.',
      de: 'Im Kampf verteilen sich Begleiter, suchen Positionen und greifen selbstständig Ziele an. Über ihre Aktionslisten kannst du trotzdem eingreifen. Richte die Aktionshand auf einen Runner und drücke {B}. Examine öffnet seinen Status mit Attributen, Ausrüstung, Skills und Cyber. Talk beginnt ein Gespräch mit dem Begleiter.',
    },
  },
  {
    id: 'runner-orders',
    chapter: 'combat',
    source: MANUAL_EXTRA_SOURCES.orders,
    title: { en: 'Target and Move To', de: 'Angriffsziel und Position vorgeben' },
    text: {
      en: 'During combat, choose Target in a runner’s action list, point at an enemy and confirm with {B} to assign that enemy. This helps concentrate fire on the most dangerous opponent. Move To lets you select a new position for the runner, for example to clear your path or reduce exposure. Repositioning can also change which enemy the runner attacks.',
      de: 'Wähle im Kampf Target in der Aktionsliste eines Runners, zeige auf einen Gegner und bestätige mit {B}, um dieses Ziel vorzugeben. So kannst du das Feuer auf den gefährlichsten Gegner konzentrieren. Mit Move To legst du eine neue Position fest, etwa um einen Weg freizumachen oder den Runner weniger offen stehen zu lassen. Ein Positionswechsel kann auch seine Zielwahl verändern.',
    },
  },
  {
    id: 'runner-equipment-and-healing',
    chapter: 'combat',
    source: MANUAL_EXTRA_SOURCES.runnerCare,
    title: { en: 'Equip and heal your party', de: 'Die Gruppe ausrüsten und heilen' },
    text: {
      en: 'You can give spare weapons and armor to runners instead of selling them. The recipient must have enough Strength to use the item. Check everyone’s Stamina after major fights. Healing spells, hired magic users and Slap Patches can keep companions alive when no bed is nearby. Slap Patches must be bought and used up, unlike spell points that can be restored by resting.',
      de: 'Übrige Waffen und Rüstungen kannst du Begleitern geben, statt sie zu verkaufen. Der Empfänger braucht genügend Strength, um sie zu benutzen. Kontrolliere nach größeren Kämpfen die Stamina aller Gruppenmitglieder. Heilzauber, angeheuerte Magieanwender und Slap Patches helfen, wenn kein Bett erreichbar ist. Slap Patches werden gekauft und verbraucht; Zauberpunkte lassen sich dagegen durch Ruhe wiederherstellen.',
    },
  },
  {
    id: 'party-status',
    chapter: 'combat',
    source: MANUAL_EXTRA_SOURCES.party,
    title: { en: 'Party status at a glance', de: 'Gruppenstatus auf einen Blick' },
    text: {
      en: '{Select} opens party status from the main game view. It lists Jake and his companions with their Stamina and spell points, in following order. Defeated companions disappear from the list and the remaining entries move up. Check it after fights to spot anyone who needs healing or rest. You can also use it without companions to check Jake’s own reserves.',
      de: '{Select} öffnet im Hauptspielbild den Gruppenstatus. Er zeigt Jake und seine Begleiter mit Stamina und Zauberpunkten in ihrer Reihenfolge hinter ihm. Besiegte Begleiter verschwinden aus der Liste; die übrigen rücken nach. Prüfe die Anzeige nach Kämpfen, um rechtzeitig Heilungs- oder Ruhebedarf zu erkennen. Auch ohne Begleiter kannst du damit Jakes Vorräte prüfen.',
    },
  },
  {
    id: 'learning-skills',
    chapter: 'skills',
    source: MANUAL_EXTRA_SOURCES.socialSkills,
    title: { en: 'Learning and improving skills', de: 'Fertigkeiten lernen und verbessern' },
    text: {
      en: 'Jake begins with Firearms and Computer at level 1. Newly learned skills also begin at level 1 and improve through Karma. Skills remain active automatically; you do not need to equip them. The ordinary skill range reaches level 6; Firearms has a separate, explicitly stated maximum of 16.',
      de: 'Jake beginnt mit Firearms und Computer auf Stufe 1. Neu erlernte Fertigkeiten starten ebenfalls auf Stufe 1 und lassen sich mit Karma steigern. Sie wirken automatisch und müssen nicht ausgerüstet werden. Der normale Fertigkeitsbereich reicht bis Stufe 6; für Firearms ist ausdrücklich ein eigener Höchstwert von 16 angegeben.',
    },
  },
  {
    id: 'leadership',
    chapter: 'skills',
    source: MANUAL_EXTRA_SOURCES.socialSkills,
    title: { en: 'Leadership', de: 'Leadership: Führungsfähigkeit' },
    text: {
      en: 'Leadership helps hired shadowrunners remain with you through dangerous runs. Better leadership lets them face more adversaries before ending their contracts. When a runner has had enough, they leave and return to the location where you hired them.',
      de: 'Leadership hilft dabei, angeheuerte Shadowrunner bei gefährlichen Runs länger zu halten. Mit besserer Führung kämpfen sie gegen mehr Gegner, bevor sie ihren Vertrag beenden. Hat ein Runner genug, verlässt er dich und kehrt an den Ort zurück, an dem du ihn angeheuert hast.',
    },
  },
  {
    id: 'negotiation',
    chapter: 'skills',
    source: MANUAL_EXTRA_SOURCES.socialSkills,
    title: { en: 'Negotiation', de: 'Negotiation: Verhandeln' },
    text: {
      en: 'Negotiation lowers many purchase prices and shadowrunner hiring fees. The discount is applied automatically when an offer is made. There is no separate haggling sequence: improving the skill changes the prices offered to you.',
      de: 'Negotiation senkt viele Kaufpreise und die Kosten zum Anheuern von Shadowrunnern. Der Nachlass wird beim Angebot automatisch berücksichtigt. Es gibt keine gesonderte Feilschsequenz: Eine bessere Fertigkeit verändert die angebotenen Preise.',
    },
  },
  {
    id: 'computer',
    chapter: 'skills',
    source: MANUAL_EXTRA_SOURCES.technicalSkills,
    title: { en: 'Computer', de: 'Computer: Matrixfertigkeit' },
    text: {
      en: 'A higher Computer skill reduces Stamina losses from Matrix IC attacks and improves your chances when fighting IC. Jake starts at level 1. Improve this skill as you reach stronger Matrix defenses; repeated failed attacks against tougher IC can be costly.',
      de: 'Ein höherer Computer-Wert verringert Stamina-Verluste durch Matrix-IC und verbessert deine Erfolgschancen im Kampf gegen IC. Jake beginnt auf Stufe 1. Steigere diese Fertigkeit für stärkere Matrixabwehr: Wiederholte Fehlversuche gegen mächtigeres IC können teuer werden.',
    },
  },
  {
    id: 'firearms',
    chapter: 'skills',
    source: MANUAL_EXTRA_SOURCES.technicalSkills,
    title: { en: 'Firearms', de: 'Firearms: Schusswaffen' },
    text: {
      en: 'Firearms improves the accuracy of your shots. More reliable hits help defeat enemies sooner and reduce the time you spend exposed in combat. It begins at level 1 and can reach level 16. This is a skill level, not the Strength requirement or damage value of a weapon.',
      de: 'Firearms verbessert die Genauigkeit deiner Schüsse. Zuverlässigere Treffer helfen, Gegner schneller zu besiegen und die Zeit unter Beschuss zu verkürzen. Die Fertigkeit beginnt auf Stufe 1 und reicht bis Stufe 16. Dieser Wert ist weder die Stärkevoraussetzung noch der Schadenswert einer Waffe.',
    },
  },
  {
    id: 'beds-and-rest',
    chapter: 'recovery',
    source: MANUAL_EXTRA_SOURCES.resting,
    title: { en: 'Rest at a bed', de: 'An einem Bett ausruhen' },
    text: {
      en: 'Beds around the city let you rest, recover and save. Walk to a bed, select it with the action glove and choose Use. The sleep menu offers saving and spending Karma. Choose Exit to replenish Stamina and spell points and return to play. Rest also restores the reserves of your currently hired runners.',
      de: 'In Betten in der Stadt kannst du ruhen, dich erholen und speichern. Gehe zu einem Bett, wähle es mit der Aktionshand und benutze Use. Das Schlafmenü bietet Speichern und Karmaausgabe an. Mit Exit füllst du Stamina und Zauberpunkte auf und kehrst zum Spiel zurück. Ruhe stellt auch die Vorräte deiner aktuell angeheuerten Begleiter wieder her.',
    },
  },
  {
    id: 'save-at-bed',
    chapter: 'recovery',
    source: MANUAL_EXTRA_SOURCES.resting,
    title: { en: 'Save your progress', de: 'Fortschritt speichern' },
    text: {
      en: 'Choose Save Game in the sleep menu, select a save slot and confirm with {B}. A sound indicates that saving has completed. The normal slots are Game 1 and Game 2. Continue later through Start Saved Game at the title menu.',
      de: 'Wähle Save Game im Schlafmenü, dann einen Speicherplatz und bestätige mit {B}. Ein Ton zeigt den abgeschlossenen Speichervorgang an. Die normalen Plätze heißen Game 1 und Game 2. Fortsetzen kannst du später über den Start eines gespeicherten Spiels im Titelmenü.',
    },
  },
  {
    id: 'browser-save-options',
    chapter: 'recovery',
    browser: true,
    title: { en: 'Browser save options', de: 'Speicheroptionen im Browser' },
    text: {
      en: 'Save at a bed or with Options → Save/load game → Save now while Jake can move freely. Loading places him at the current room’s entrance. The browser keeps saved slots locally; clearing browser data can erase them. Export downloads all saved slots as .srm, without saving current progress first. Import replaces stored slots and ends a running session. After importing, choose Start game, then Start saved game in the title menu and the desired slot. Choose Four save slots before starting a session.',
      de: 'Speichere an einem Bett oder unter Optionen → Spiel speichern/laden → Jetzt speichern, solange Jake sich frei bewegen kann. Beim Laden beginnt er am Eingang des aktuellen Raums. Der Browser bewahrt gespeicherte Plätze lokal auf; beim Löschen der Browserdaten können sie verloren gehen. Exportieren lädt alle gespeicherten Plätze als .srm herunter, speichert aber nicht vorher den aktuellen Fortschritt. Importieren ersetzt die gespeicherten Plätze und beendet eine laufende Partie. Wähle danach Spiel starten, im Titelmenü Gesichertes Spiel starten und den gewünschten Speicherplatz. Wähle Vier Speicherplätze vor dem Sitzungsstart.',
    },
  },
  {
    id: 'earning-karma',
    chapter: 'karma',
    source: MANUAL_EXTRA_SOURCES.karma,
    title: { en: 'Earn Karma', de: 'Karma verdienen' },
    text: {
      en: 'Defeating enemies earns Karma after enough progress has accumulated. Harder opponents bring rewards sooner. Karma is spent on permanent improvements to attributes, skills and spell levels. It is separate from nuyen: buying equipment does not spend Karma.',
      de: 'Durch besiegte Gegner verdienst du Karma, sobald genügend Fortschritt gesammelt wurde. Stärkere Gegner führen schneller zu einer Belohnung. Mit Karma verbesserst du Attribute, Fertigkeiten und Zauberstufen dauerhaft. Es ist von Nuyen getrennt: Ausrüstungskäufe verbrauchen kein Karma.',
    },
  },
  {
    id: 'spending-karma',
    chapter: 'karma',
    source: MANUAL_EXTRA_SOURCES.karma,
    title: { en: 'Spend Karma while resting', de: 'Karma beim Ausruhen einsetzen' },
    text: {
      en: 'At a bed, choose Use Karma to open the improvement menu. Your available Karma appears at the upper left. Select Attribute, Skills or Magic, then an entry and confirm with {Start} to raise it by one level. The cost is deducted automatically. Higher levels cost more; for example, raising Firearms from 10 to 11 costs 10 Karma. Check the offered improvement and your remaining points before confirming.',
      de: 'Wähle an einem Bett Use Karma, um das Steigerungsmenü zu öffnen. Dein verfügbares Karma steht links oben. Wähle Attribute, Skills oder Magic, dann einen Eintrag und bestätige mit {Start}, um ihn um eine Stufe zu erhöhen. Die Kosten werden automatisch abgezogen. Höhere Stufen sind teurer: Firearms von 10 auf 11 kostet beispielsweise 10 Karma. Prüfe vor dem Bestätigen die angebotene Steigerung und deine verbleibenden Punkte.',
    },
  },
  {
    id: 'talking-to-people',
    chapter: 'dialogue',
    source: MANUAL_EXTRA_SOURCES.conversations,
    title: { en: 'Talk and listen', de: 'Reden und zuhören' },
    text: {
      en: 'Some people speak to you automatically, but usually you must approach them. Select a person with the action glove and choose Talk. Their portrait and dialogue appear in the upper part of the screen; Jake’s portrait and your choices appear below. Talk can reveal more general information after the opening remark, so read both the greeting and follow-up lines.',
      de: 'Manche Personen sprechen dich von selbst an, meistens musst du aber den ersten Schritt machen. Wähle die Person mit der Aktionshand und dann Talk. Oben erscheinen ihr Porträt und ihre Aussagen, darunter Jakes Porträt und deine Gesprächsoptionen. Talk kann nach der Begrüßung weitere allgemeine Informationen liefern. Lies deshalb sowohl die erste Aussage als auch die folgenden Antworten.',
    },
  },
  {
    id: 'keywords',
    chapter: 'dialogue',
    source: MANUAL_EXTRA_SOURCES.keywords,
    title: { en: 'Keywords and Ask About', de: 'Schlüsselwörter und Nachfragen' },
    text: {
      en: 'Conversations teach you keywords that you can ask this or other people about. Choose Ask About to open the vocabulary inventory. Move through its alphabetically sorted terms and confirm a word with {B}. When there are more entries than fit, an arrow indicates additional pages. {L} moves to the previous keyword page; {R} moves to the next. Revisit people with new keywords when a lead seems to stop.',
      de: 'In Gesprächen lernst du Schlüsselwörter, nach denen du dieselbe Person oder andere Menschen fragen kannst. Ask About öffnet das Wortinventar. Wähle einen alphabetisch sortierten Begriff und bestätige mit {B}. Passen nicht alle Einträge ins Fenster, zeigt ein Pfeil weitere Seiten an. {L} wechselt zur vorherigen, {R} zur nächsten Schlüsselwortseite. Frage mit neuen Begriffen erneut nach, wenn eine Spur zunächst nicht weiterführt.',
    },
  },
  {
    id: 'vidphone',
    chapter: 'dialogue',
    source: MANUAL_EXTRA_SOURCES.vidphone,
    title: { en: 'Use the Vidphone', de: 'Das Vidphone benutzen' },
    text: {
      en: 'Find a credstick and use it with a Vidphone to make calls. Select the phone with the action glove and choose Use. Known numbers appear in the dialing directory. Choose a number with {Up} / {Down} and confirm with {B}. If the person answers, the normal conversation windows open, with the same Talk and keyword options as a face-to-face meeting.',
      de: 'Besorge einen Credstick und benutze ihn am Vidphone, um Anrufe zu führen. Wähle das Telefon mit der Aktionshand und dann Use. Bekannte Nummern erscheinen im Rufnummernverzeichnis. Wähle mit {Up} / {Down} eine Nummer und bestätige mit {B}. Nimmt die Person ab, öffnen sich die normalen Gesprächsfenster mit denselben Talk- und Schlüsselwortoptionen wie bei einem direkten Treffen.',
    },
  },
  {
    id: 'matrix-equipment',
    chapter: 'matrix',
    source: MANUAL_EXTRA_SOURCES.matrixEquipment,
    title: { en: 'Datajack and cyberdeck', de: 'Datajack und Cyberdeck' },
    text: {
      en: 'The Matrix is the global communications grid. A decker enters it through a connected terminal to obtain information, transfer nuyen and affect electronic systems such as locks. You need a fitted datajack and a cyberdeck between it and the grid. The cyberdeck provides your Matrix persona, attack and defense programs, and storage for downloaded data.',
      de: 'Die Matrix ist das weltweite Kommunikationsnetz. Ein Decker betritt sie über ein angeschlossenes Terminal, um Informationen zu beschaffen, Nuyen zu übertragen und elektronische Systeme wie Schlösser zu beeinflussen. Du brauchst einen eingebauten Datajack und ein Cyberdeck zwischen Anschluss und Netz. Das Cyberdeck stellt deine Matrixpersona, Angriffs- und Abwehrprogramme sowie Speicher für heruntergeladene Daten bereit.',
    },
  },
  {
    id: 'matrix-layout',
    chapter: 'matrix',
    source: MANUAL_EXTRA_SOURCES.matrixLayout,
    title: {
      en: 'Terminals, datalines and status bars',
      de: 'Terminals, Datenleitungen und Statusbalken',
    },
    text: {
      en: 'After jacking in, your small persona appears beside the terminal you used. Datalines connect tiled areas and let you travel through the system. At the lower left, the upper status bar shows Stamina and the lower bar shows used storage. If storage fills, more datastore downloads fail with Out of Storage, but you can still attack IC and CPUs. Do not let Stamina reach zero: that is fatal.',
      de: 'Nach dem Einloggen erscheint deine kleine Persona neben dem benutzten Terminal. Datenleitungen verbinden die gekachelten Bereiche des Systems. Links unten zeigt der obere Statusbalken Stamina und der untere die Speicherbelegung. Ist der Speicher voll, scheitern weitere Datenspeicher-Downloads mit Out of Storage. IC und CPUs kannst du weiterhin angreifen. Lass Stamina nicht auf null fallen: Das ist tödlich.',
    },
  },
  {
    id: 'matrix-nodes',
    chapter: 'matrix',
    source: MANUAL_EXTRA_SOURCES.matrixLayout,
    title: { en: 'Nodes and passwords', de: 'Knoten und Passwörter' },
    text: {
      en: 'Nodes lie along datalines, especially at junctions. Many are passable, but protected nodes need the correct password. Find passwords through other terminals or from people. A password is kept as an inventory item; once you have the right one, you can pass its locked node without manually entering a code.',
      de: 'Knoten liegen auf Datenleitungen, besonders an Kreuzungen. Viele lassen sich einfach passieren, geschützte Knoten benötigen jedoch das richtige Passwort. Du findest Passwörter über andere Terminals oder bei Personen. Ein Passwort wird als Inventargegenstand gespeichert. Hast du das passende, kannst du den gesperrten Knoten ohne manuelle Codeeingabe passieren.',
    },
  },
  {
    id: 'matrix-ic',
    chapter: 'matrix',
    source: MANUAL_EXTRA_SOURCES.matrixCombat,
    title: { en: 'Find and fight IC / ICE', de: 'IC / ICE finden und bekämpfen' },
    text: {
      en: 'Tiled areas can hide Intrusion Countermeasure Electronics, called IC or ICE. Your trace program scans the eight tiles around your current tile and reports how many IC it detects. Use changing counts as you move to infer their positions. Face a suspected tile and press {B} to attack. Attacking an empty tile fails and costs Stamina; a successful attack destroys the IC and makes its tile safe.',
      de: 'In gekachelten Bereichen kann sich Intrusion Countermeasure Electronics verstecken, kurz IC oder ICE. Dein Suchprogramm untersucht die acht Felder um dein aktuelles Feld und meldet die Anzahl gefundener IC. Leite aus den wechselnden Zahlen ihre Positionen ab. Schaue auf ein verdächtiges Feld und greife mit {B} an. Ein Angriff auf ein leeres Feld scheitert und kostet Stamina. Ein erfolgreicher Angriff zerstört das IC und macht sein Feld sicher.',
    },
  },
  {
    id: 'matrix-damage',
    chapter: 'matrix',
    source: MANUAL_EXTRA_SOURCES.matrixData,
    title: { en: 'Survive stronger defenses', de: 'Stärkere Abwehr überleben' },
    text: {
      en: 'Stepping onto a live IC tile costs Stamina and throws you back onto the tile you came from. Stronger IC may need more attack attempts and inflict greater losses when an attempt fails. Improve Computer and watch your Stamina rather than attacking tiles at random. Jack out before a dangerous run becomes fatal.',
      de: 'Betrittst du ein Feld mit unzerstörtem IC, verlierst du Stamina und wirst auf das vorherige Feld zurückgeworfen. Stärkeres IC kann mehr Angriffsversuche erfordern und bei Fehlschlägen größere Verluste verursachen. Steigere Computer und beobachte deine Stamina, statt wahllos Felder anzugreifen. Logge dich aus, bevor ein gefährlicher Run tödlich endet.',
    },
  },
  {
    id: 'matrix-downloads',
    chapter: 'matrix',
    source: MANUAL_EXTRA_SOURCES.matrixData,
    title: { en: 'Download from datastores', de: 'Daten aus Datenspeichern laden' },
    text: {
      en: 'Datastores appear as white blocks. Reach an adjacent position, face the block and press {A} to download. The block becomes transparent after the download. When you jack out, messages explain what you retrieved. Downloads are not all equally useful and take storage, so watch the capacity bar.',
      de: 'Datenspeicher erscheinen als weiße Blöcke. Gehe auf ein benachbartes Feld, schaue zum Block und lade mit {A} die Daten herunter. Anschließend wird der Block durchsichtig. Beim Ausloggen erklären Meldungen, was du erhalten hast. Nicht alle Downloads sind nützlich, und sie belegen Speicher. Behalte deshalb den Kapazitätsbalken im Blick.',
    },
  },
  {
    id: 'matrix-data-types',
    chapter: 'matrix',
    source: MANUAL_EXTRA_SOURCES.matrixData,
    title: { en: 'Passwords, datafiles and accounts', de: 'Passwörter, Datendateien und Konten' },
    text: {
      en: 'Passwords unlock protected nodes. Datafiles hold information and remain in your Items inventory for examination; their names have a DF prefix. Accounts transfer nuyen to your credstick, reflected in the status screen. You may also download useless trash data, which is discarded automatically when you jack out.',
      de: 'Passwörter öffnen geschützte Knoten. Datendateien enthalten Informationen und bleiben zum Untersuchen im Gegenstandsinventar. Ihre Namen beginnen mit DF. Konten übertragen Nuyen auf deinen Credstick; der neue Betrag erscheint im Status. Du kannst auch nutzlose Daten herunterladen. Diese werden beim Ausloggen automatisch verworfen.',
    },
  },
  {
    id: 'matrix-cpus',
    chapter: 'matrix',
    source: MANUAL_EXTRA_SOURCES.matrixExit,
    title: { en: 'Attack CPUs', de: 'CPUs angreifen' },
    text: {
      en: 'CPUs control systems outside the Matrix. Defeating one can open electronic doors or elevators and disable alarms or security devices. Some CPUs are linked to their area’s IC, destroying that hidden defense when defeated. Face a CPU and press {B} to attack it.',
      de: 'CPUs steuern Systeme außerhalb der Matrix. Ihr Besiegen kann elektronische Türen oder Aufzüge öffnen und Alarmanlagen oder Sicherheitseinrichtungen abschalten. Manche CPUs sind mit dem IC ihres Bereichs verbunden und zerstören diese versteckte Abwehr bei ihrer Niederlage. Schaue zu einer CPU und greife sie mit {B} an.',
    },
  },
  {
    id: 'matrix-jack-out',
    chapter: 'matrix',
    source: MANUAL_EXTRA_SOURCES.matrixExit,
    title: { en: 'Leave the Matrix', de: 'Die Matrix verlassen' },
    text: {
      en: 'Press {X} to leave the Matrix from any location in the grid. Your programs end and Jake reappears beside the terminal where he entered. You do not need to walk all the way back to the entry point. Review download messages and check your Stamina before deciding whether to enter again.',
      de: 'Mit {X} verlässt du die Matrix von jeder Stelle des Netzes aus. Deine Programme enden und Jake erscheint wieder neben dem Einstiegsterminal. Du musst also nicht den ganzen Weg zum Eingang zurückgehen. Lies die Downloadmeldungen und prüfe deine Stamina, bevor du erneut einsteigst.',
    },
  },
];
