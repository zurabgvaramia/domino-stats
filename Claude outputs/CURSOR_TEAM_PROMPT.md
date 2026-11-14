# დომინო — ერთიანი პრომპტი Cursor-ისთვის

## სანამ Cursor-ს გაუშვებ (შენ თვითონ, 5 წუთი)

1. **Git.** `D:\Domino`-ში ტერმინალში:
   ```
   git init
   git add .
   git commit -m "ეტაპები 0-8"
   ```
   პარალელურ აგენტებს git სჭირდებათ, თან ყოველთვის შეძლებ ამ წერტილზე დაბრუნებას.
2. **ბაზა.** Supabase → SQL Editor → გაუშვი `migration_2.sql`.
3. **რეგისტრაცია.** Supabase → Authentication → Sign In / Providers → გამორთე **Allow new users to sign up**. Email პროვაიდერი ჩართული დატოვე.
4. **მომხმარებლები.** Authentication → Users → **Add user → Create new user**: თითო მეგობარზე ელფოსტა და პაროლი, **Auto Confirm User** მონიშნული.
5. **როლები.** SQL Editor-ში თითო რედაქტორზე:
   ```sql
   insert into public.app_roles (user_id, role, display_name)
   select id, 'editor', 'სახელი' from auth.users where email = 'მისი@email.ge';
   ```
   შენთვის `'editor'`-ის ნაცვლად `'admin'` ჩაწერე.

ამის შემდეგ ქვემოთა ბლოკი მთლიანად ჩასვი Cursor-ის Agent-ში.

---

## პრომპტი (მთლიანად დააკოპირე)

```
შენ ხარ ამ სამუშაოს წამყვანი (lead). პროექტი: D:\Domino — React + Vite + Supabase, მეგობრების დომინოს სტატისტიკა. ინტერფეისი მთლიანად ქართულია, mobile-first.

შენი როლი: შექმენი აგენტების გუნდი, დაურიგე დავალებები, აკონტროლე ხარისხი და ბოლოს გააერთიანე. გამოიყენე subagent-ები ან პარალელური აგენტები (worktree-ებით), რაც ამ Cursor-ში ხელმისაწვდომია. თუ პარალელური აგენტები არ გაქვს, დავალებები თანმიმდევრულად შეასრულე იმავე რიგით და იმავე წესებით.

═══════════════════════════════════
ბაზის კონტრაქტი (უკვე გაშვებულია Supabase-ში, SQL-ს ნუ შეცვლით)
═══════════════════════════════════
ცხრილი matches: a1, a2 (გუნდი A), b1, b2 (გუნდი B), winner 'A'|'B', win_type 'regular'|'sukhoi'|'koksi', points (ბაზა ითვლის: 1|2|3), note, is_void, played_at.
ბაზა წყვილს თვითონ ალაგებს: ყოველთვის a1 < a2 და b1 < b2.

მოგების ტიპები ინტერფეისში:
  regular → „ოინი“ (1 ქულა)
  sukhoi  → „სუხოი“ (2 ქულა)
  koksi   → „კოქსი“ (3 ქულა)
მინიშნება ფორმაში: „კოქსი — წაგებულს 100 ან ნაკლები აქვს. სუხოი — 200 ან ნაკლები. სხვა შემთხვევაში ოინი.“

RPC player_stats(p_from, p_to) აბრუნებს:
  place, player_id, name, games, wins, losses, win_pct,
  points_won, points_lost, net_points,
  oini_made, sukhoi_made, koksi_made, oini_taken, sukhoi_taken, koksi_taken
RPC pair_stats(p_from, p_to) აბრუნებს:
  place, p1, p2, p1_name, p2_name, + იგივე სვეტები, რაც player_stats-ს.
  ორივე უკვე დალაგებულია რეიტინგის წესით.
RPC partner_stats(p_player, p_from, p_to), opponent_stats(p_player, p_from, p_to): უცვლელია.
RPC pair_h2h(p_a1, p_a2, p_b1, p_b2, p_from, p_to) აბრუნებს ერთ სტრიქონს:
  games, a_wins, b_wins, a_points, b_points, a_net,
  a_oini, a_sukhoi, a_koksi, b_oini, b_sukhoi, b_koksi, first_played, last_played
  (A = პირველი წყვილი, B = მეორე; წყვილში თანმიმდევრობას მნიშვნელობა არ აქვს)
RPC match_history(p_match) აბრუნებს (უკვე დალაგებულია, ახალი ზემოთ):
  id, action 'INSERT'|'UPDATE'|'DELETE', old_row jsonb, new_row jsonb, changed_at, changed_by_name
view v_player_results: match_id, played_at, player_id, partner_id, team, opp1, opp2, won, win_type, points
view v_pair_results: match_id, played_at, p1, p2, o1, o2, team, won, win_type, points

რეიტინგის წესი (მოთამაშეებიც და წყვილებიც):
  1) ქულა = მოგებული ქულები − წაგებული ქულები (net_points), მეტი უკეთესია;
  2) თანაბრობისას — მეტი კოქსი (koksi_made);
  3) ისევ თანაბრობისას — მეტი სუხოი (sukhoi_made);
  4) ისევ თანაბრობისას — ადგილს იყოფენ (ერთნაირი ნომერი, მაგ. 1, 1, 3).

ID-ები: Supabase bigint-ს JavaScript-ში რიცხვად აბრუნებს. useParams(), URLSearchParams და <select> კი სტრიქონს. ყოველთვის გადააქციე Number()-ით, სანამ შეადარებ ან ბაზას გაუგზავნი.

═══════════════════════════════════
ნაბიჯი 1 — შენ თვითონ (აგენტების გაშვებამდე)
═══════════════════════════════════
საერთო ფაილები, რომლებზეც ყველა აგენტი იქნება დამოკიდებული. ჯერ ეს გააკეთე და commit-ი გააკეთე, მერე გაუშვი გუნდი.

1. src/lib/format.js:
   - WIN_LABEL.regular = 'ოინი'.
   - დაამატე და გაიტანე export WIN_TYPES = [
       { id: 'regular', label: 'ოინი', points: 1 },
       { id: 'sukhoi',  label: 'სუხოი', points: 2 },
       { id: 'koksi',   label: 'კოქსი', points: 3 },
     ]
   - დაამატე export WIN_HINT — ზემოთ მოცემული მინიშნების ტექსტი.
   - დაამატე export function toId(value) — აბრუნებს მთელ დადებით რიცხვს ან null-ს.
2. ახალი src/lib/ranking.js:
   - export function compareRank(a, b) — რეიტინგის წესის 1–3 პუნქტი (net_points, koksi_made, sukhoi_made, ყველა კლებადობით). აბრუნებს 0-ს სრული თანაბრობისას.
   - export function assignPlaces(rows) — rows უკვე compareRank-ით დალაგებული. აბრუნებს ახალ მასივს, სადაც თითოს აქვს place (გაზიარებული ადგილი: 1, 1, 3). ეს საჭიროა, როცა „მინიმუმ N თამაში“ ფილტრი სიას ამცირებს და ბაზის place-ის ხელახლა დათვლაა საჭირო.
3. commit: "საერთო: მოგების ტიპები, რეიტინგის წესი".

═══════════════════════════════════
ნაბიჯი 2 — გუნდი (5 აგენტი პარალელურად)
═══════════════════════════════════
მკაცრი წესი ყველა აგენტისთვის:
- შეცვალე მხოლოდ შენი ფაილები. სხვის ფაილს არ შეეხო. format.js და ranking.js მხოლოდ წაიკითხე.
- თუ სხვის ფაილში ცვლილება გჭირდება, არ გააკეთო. lead-ს მოახსენე.
- SQL და Supabase-ის პარამეტრები არ შეცვალო.
- ქართული ტექსტი ბუნებრივი და გამართული იყოს.
- დასრულებისას: npm run lint უნდა გადიოდეს შეცდომის გარეშე; მოკლედ ჩამოწერე, რა შეცვალე.

──── აგენტი A: შესვლა ელფოსტით და პაროლით ────
ფაილები: src/pages/LoginPage.jsx, src/lib/supabase.js, src/main.jsx, .env.example
მიზეზი: magic link არ გამოდგება — Supabase-ის ჩაშენებული ფოსტა მხოლოდ პროექტის გუნდის წევრებს უგზავნის წერილს, საათში 2-ის ლიმიტით. PKCE ბმული სხვა ბრაუზერში ან PWA-დან გახსნისას ვერ მუშაობს. ანგარიშებს ადმინი ქმნის Supabase-ის პანელში.
1. LoginPage.jsx: ელფოსტა + პაროლის ფორმა, supabase.auth.signInWithPassword.
   - პაროლის ველი: type="password", autoComplete="current-password", „ჩვენება/დამალვა“ ღილაკი.
   - წარმატების შემდეგ navigate('/').
   - "Invalid login credentials" → „ელფოსტა ან პაროლი არასწორია.“ სხვა შეცდომები georgianError-ით.
   - ქვემოთ: „ანგარიშს ადმინი ქმნის. პაროლი თუ დაგავიწყდა, ადმინს მიმართე.“
   - magic link და sessionStorage 'auth-error' ამოიღე.
2. supabase.js: ამოიღე flowType: 'pkce'; detectSessionInUrl: false; siteUrl() წაშალე, თუ აღარსად გამოიყენება (მოძებნე მთელ src-ში, მაგრამ სხვა ფაილს არ შეცვალო — თუ სადმე გამოიყენება, lead-ს უთხარი).
3. main.jsx: ამოიღე URL hash-ის access_token/error_description-ის დამუშავება.
4. .env.example: Redirect URLs-ის კომენტარი შეცვალე ამით: „მომხმარებლებს ადმინი ქმნის: Supabase → Authentication → Users → Add user (Auto Confirm User).“

──── აგენტი B: მოთამაშის პროფილი და წყვილის გვერდი ────
ფაილები: src/pages/PlayerPage.jsx, src/pages/PairDetailPage.jsx
შეცდომა: useParams() სტრიქონს აბრუნებს, ბაზა რიცხვს. `item.id === id` არასდროს ემთხვევა → პროფილი ყოველთვის „ვერ მოიძებნა“-ს აჩვენებს; წყვილის ბარათები ცარიელია.
1. ორივე გვერდზე params toId()-ით გადააქციე. არასწორ ID-ზე მოთხოვნა არ გაგზავნო, „ვერ მოიძებნა“ აჩვენე.
2. ყველა შედარება, RPC პარამეტრი, .eq()/.or() ფილტრი და useEffect-ის დამოკიდებულება რიცხვებით.
3. ზედა ბარათები ორივე გვერდზე: ადგილი (place), ქულა (net_points, ნიშნით +/−), თამაში, მოგება (ქულა) = points_won, წაგება (ქულა) = points_lost, ოინი / სუხოი / კოქსი (made, ქვემოთ პატარად: „მიიღო: X“ taken-ით).
4. მოგების ტიპის ყველა წარწერა WIN_LABEL / WIN_TYPES-იდან.
5. PairDetailPage: მოწინააღმდეგე წყვილების ცხრილის თითო სტრიქონს დაამატე ღილაკი „შედარება“ → `/compare?a=${p1}-${p2}&b=${o1}-${o2}` (პერიოდის search პარამეტრები შეინარჩუნე).

──── აგენტი C: ჩაწერა, პარტიები, ისტორია ────
ფაილები: src/pages/RecordPage.jsx, src/pages/MatchesPage.jsx, src/lib/audit.js, src/components/MatchLine.jsx
1. RecordPage.jsx და MatchesPage.jsx: ლოკალური TYPES მასივები წაშალე, გამოიყენე WIN_TYPES (ღილაკზე: „ოინი (1)“, „სუხოი (2)“, „კოქსი (3)“). მინიშნება — WIN_HINT.
2. RecordPage.jsx: lastMatch-ის მოთხოვნას დაამატე .eq('is_void', false). played_at ჩასმისას ნუ გაგზავნი — ბაზის default now() გამოიყენოს (ტელეფონის საათი შეიძლება არასწორი იყოს).
3. MatchesPage.jsx — რედაქტირება: <select>-ის onChange-ში toId(). draft-ში მხოლოდ რიცხვები ან null; ერთი მოთამაშე ორ ადგილას ფორმაშივე იბლოკება. გამარჯვებულის ღილაკებზე „გუნდი A“-ს ნაცვლად წყვილის სახელები.
4. MatchesPage.jsx — ისტორია: supabase.from('match_audit') შეცვალე supabase.rpc('match_history', { p_match: selected.id }). თითო ჩანაწერში: მოქმედება, ვინ (changed_by_name), როდის, ცვლილებები.
5. audit.js:
   - auditTitle: INSERT → „შეიქმნა“, UPDATE → „შეიცვალა“, DELETE → „წაიშალა“. თუ UPDATE-ში მხოლოდ is_void შეიცვალა: false→true „გაუქმდა“, true→false „აღდგა“.
   - auditLines: გამოტოვე id, points, created_at, updated_at, created_by, updated_by. INSERT-ზე ხაზები არ აჩვენო.
   - auditWhen: row.changed_at.
   - ამოიღე ალტერნატიული ველების სახელები (operation, diff, before, after და სხვ.).
6. MatchLine.jsx: მოგების ტიპის ნიშანი WIN_LABEL-იდან (ოინზე ნიშანი არ ჩანდეს, სუხოიზე და კოქსზე ჩანდეს, ქულით: „სუხოი +2“, „კოქსი +3“).

──── აგენტი D: რეიტინგის ცხრილები ────
ფაილები: src/components/StatsBoard.jsx, src/lib/stats.js, src/lib/usePeriod.js, src/pages/TablePage.jsx, src/pages/PairsPage.jsx, src/pages/SpecialsPage.jsx
1. ცხრილის სვეტები (მოთამაშეებიც და წყვილებიც), ამ რიგით:
   ადგილი | სახელი | თამაში | მოგება (ქულა) | წაგება (ქულა) | ქულა | ოინი | სუხოი | კოქსი
   - მოგება (ქულა) = points_won, წაგება (ქულა) = points_lost, ქულა = net_points (+/− ნიშნით, ფერით).
   - ოინი / სუხოი / კოქსი = oini_made / sukhoi_made / koksi_made.
   - ტელეფონზე კომპაქტურად: ადგილი, სახელი, ქულა, კოქსი/სუხოი; სტრიქონზე დაჭერით გაიშალოს დანარჩენი + მოგების % + „მიიღო“ (taken) მაჩვენებლები.
2. ნაგულისხმევი დალაგება = რეიტინგის წესი (compareRank). „ადგილი“ სვეტზე დაჭერა ამ დალაგებას აბრუნებს. სხვა სვეტებზე დაჭერით დალაგება იცვლება, მაგრამ ადგილის ნომერი ყოველთვის ოფიციალური რჩება.
3. „მინიმუმ N თამაში“ ფილტრის შემდეგ ადგილები ხელახლა დაითვალე assignPlaces()-ით, მხოლოდ კვალიფიციურ სიაზე. ნაკლები თამაშის მქონეები ქვემოთ, ცალკე, ადგილის გარეშე.
4. stats.js: STAT_COLUMNS და metric() ახალი სვეტებით (place, games, points_won, points_lost, net_points, oini, sukhoi, koksi). usePeriod.js: SORTS განაახლე იგივე გასაღებებით, ნაგულისხმევი sort = 'place', dir = 'asc'.
5. SpecialsPage.jsx: დაამატე ოინიც; ტიპების წარწერები WIN_LABEL-იდან; ახალი სვეტების სახელები (koksi_made და ა.შ. უცვლელია).

──── აგენტი E: წყვილების ურთიერთშეხვედრების შედარება ────
ფაილები: ახალი src/pages/ComparePage.jsx, src/App.jsx, src/pages/MorePage.jsx
1. მარშრუტი /compare, URL-ის ფორმატი: /compare?a=1-2&b=3-4 (+ period/from/to). App.jsx-ში დაამატე Route.
2. ComparePage:
   - ზემოთ ორი ბლოკი: „წყვილი 1“ და „წყვილი 2“, თითოში 2 მოთამაშის არჩევა chip-ებით (როგორც ჩაწერის გვერდზე). ერთი მოთამაშე ორივე წყვილში ვერ იქნება. არჩევანი URL-ში იწერება, რომ ბმული გაზიარდეს.
   - პერიოდის ფილტრი (PeriodPicker + usePeriod).
   - როცა 4 მოთამაშე არჩეულია: supabase.rpc('pair_h2h', ...).
   - შედეგი გვერდიგვერდ, „ბალანსის“ სტილში (მარცხნივ წყვილი 1, მარჯვნივ წყვილი 2, შუაში სახელწოდება):
       შეხვედრები (games, შუაში)
       მოგება | a_wins : b_wins
       ქულები | a_points : b_points
       ოინი   | a_oini : b_oini
       სუხოი  | a_sukhoi : b_sukhoi
       კოქსი  | a_koksi : b_koksi
     ზემოთ დიდად: ბალანსი a_net (მაგ. „წყვილი 1 +5“ ან „თანაბარი“). თითო სტრიქონში უპირატესი მხარე გამოყოფილი. ქვემოთ პატარად: პირველი და ბოლო შეხვედრის თარიღი.
   - ქვემოთ ამ ორი წყვილის ყველა პარტია: v_pair_results-იდან (p1/p2 = წყვილი 1, o1/o2 = წყვილი 2, ნორმალიზებული: პატარა ID პირველი), ახალი ზემოთ, MatchLine-ის სტილში (MatchLine.jsx-ს არ შეცვალო, მხოლოდ გამოიყენე).
   - შეხვედრა თუ არ ყოფილა: „ამ წყვილებს ერთმანეთთან ჯერ არ უთამაშიათ.“
   - ღილაკი „წყვილების გადაცვლა“.
   - ID-ები toId()-ით.
3. MorePage.jsx: დაამატე ბმული „წყვილების შედარება“ → /compare.

═══════════════════════════════════
ნაბიჯი 3 — შენი კონტროლი (lead)
═══════════════════════════════════
როცა თითო აგენტი დაასრულებს:
1. შეამოწმე მისი diff: შეეხო თუ არა მხოლოდ თავის ფაილებს; იყენებს თუ არა WIN_TYPES/WIN_LABEL/toId/compareRank/assignPlaces-ს; არ დარჩა თუ არა სტრიქონი-რიცხვის შედარება ID-ებზე; ქართული ტექსტი გამართულია.
2. თუ რამე აკლია, დაუბრუნე იმავე აგენტს კონკრეტული შენიშვნით.
3. მიღების შემდეგ ცალკე commit-ი: "A: პაროლით შესვლა", "B: პროფილი და წყვილი", და ა.შ.

ყველას დასრულების შემდეგ:
1. გააერთიანე ერთ ბრენჩში (main), კონფლიქტები გადაჭერი.
2. npm run lint და npm run build — ორივე შეცდომის გარეშე.
3. მთელ src-ში მოძებნე: 'regular' ტექსტად ინტერფეისში ჩანს თუ არა; „ჩვეულებრივი“ სადმე დარჩა თუ არა (უნდა იყოს „ოინი“); match_audit პირდაპირ სადმე იკითხება თუ არა (უნდა იყოს match_history); siteUrl / signInWithOtp დარჩა თუ არა.
4. npm run dev გაუშვი და ბრაუზერში 375px სიგანეზე გადაამოწმე ყველა გვერდი: /login, /, /table, /pairs, /pairs/:p1/:p2, /player/:id, /matches, /specials, /compare, /more. კონსოლში შეცდომა არ უნდა იყოს.
5. მომწერე საბოლოო ანგარიში: რა გაკეთდა, რომელი შემოწმება გავიდა, და რა ვერ შეამოწმე (მაგ. რეალური მონაცემების გარეშე).
```

---

## Cursor-ის დასრულების შემდეგ

1. `.env` შეავსე `.env.example`-ის მიხედვით და გაუშვი `npm run dev`.
2. შედი პაროლით და ჩაწერე 5–6 სატესტო პარტია. ერთში კოქსი მონიშნე, ერთში სუხოი.
3. შეამოწმე ცხრილი, მოთამაშის პროფილი, წყვილის გვერდი და შედარება. ერთი პარტია შეცვალე და ნახე ისტორია.
4. სატესტო პარტიები გააუქმე ან SQL-ით წაშალე: `delete from public.matches;`
5. GitHub-ზე ატვირთე. Settings → Pages → Source: **GitHub Actions**, ხოლო Settings → Secrets → Actions-ში ჩაწერე `VITE_SUPABASE_URL` და `VITE_SUPABASE_ANON_KEY`.
