# დომინო — შესწორებები (Cursor, პარალელური აგენტები)

## ნაბიჯი 0 — სანამ აგენტებს გაუშვებ

1. `D:\Domino`-ში ტერმინალში:
   ```
   git init
   git add .
   git commit -m "ეტაპები 0-8"
   ```
   პარალელურ აგენტებს (worktree-ებს) git-ის რეპოზიტორია სჭირდებათ. თან რამე თუ აირია, ყოველთვის დაბრუნდები ამ წერტილზე.
2. Supabase-ის SQL Editor-ში გაუშვი `fix_audit.sql`.
3. Supabase → Authentication → Sign In / Providers: გამორთე **Allow new users to sign up**, რომ უცხომ ანგარიში ვერ შექმნას. ჩართული დატოვე Email პროვაიდერი.
4. Authentication → Users → **Add user → Create new user**: თითო მეგობარზე ელფოსტა და პაროლი, **Auto Confirm User** მონიშნული.

---

## კოორდინატორის პრომპტი (ერთ აგენტს მიეცი)

```
პროექტი: D:\Domino (React + Vite + Supabase, დომინოს სტატისტიკა).
სამი დამოუკიდებელი შესწორებაა გასაკეთებელი. გაანაწილე ისინი სამ პარალელურ აგენტზე (subagent-ებზე ან ცალკე worktree-ებზე, რაც ხელმისაწვდომია), თითო დავალება თითო აგენტს.

წესი: თითოეული აგენტი ეხება მხოლოდ თავის ფაილებს, რომლებიც დავალებაშია ჩამოთვლილი. სხვის ფაილს არ ცვლის. თუ სხვის ფაილში ცვლილება დასჭირდა, გაჩერდეს და მომწეროს.

როცა სამივე დაასრულებს:
1. გააერთიანე ცვლილებები ერთ ბრენჩში.
2. გაუშვი `npm run lint` და `npm run build`, შეცდომები გაასწორე.
3. მომწერე მოკლე შეჯამება: რა შეიცვალა თითო ფაილში.

დავალებები ქვემოთაა: „აგენტი A“, „აგენტი B“, „აგენტი C“.
```

ამის ქვემოთ იმავე შეტყობინებაში ჩასვი სამივე დავალება. თუ შენს Cursor-ს subagent-ები არ აქვს, სამი ცალკე Agent-ის ჩანართი გახსენი (ან Agents ფანჯარაში სამი პარალელური აგენტი) და თითოს თავისი დავალება მიეცი. ფაილები არ იკვეთება, ამიტომ კონფლიქტი არ მოხდება.

---

## აგენტი A — შესვლა ელფოსტით და პაროლით

```
შენი ფაილები: src/pages/LoginPage.jsx, src/lib/supabase.js, src/main.jsx, .env.example.
სხვა ფაილს არ შეეხო.

პრობლემა: ახლა შესვლა magic link-ით ხდება. Supabase-ის ჩაშენებული ფოსტა წერილს მხოლოდ პროექტის გუნდის წევრებს უგზავნის, საათში 2 წერილის ლიმიტით, ამიტომ მეგობრებს ბმული არ მივა. გარდა ამისა, PKCE ბმული სხვა ბრაუზერში გახსნისას (მაგ. Gmail-იდან ან PWA-დან) ვერ მუშაობს.

გააკეთე:
1. LoginPage.jsx: magic link ჩაანაცვლე ელფოსტა + პაროლის ფორმით, supabase.auth.signInWithPassword({ email, password }).
   - პაროლის ველი: type="password", autoComplete="current-password", „ჩვენება/დამალვა“ ღილაკი.
   - წარმატების შემდეგ navigate('/') (useNavigate).
   - შეცდომა "Invalid login credentials" აჩვენე ქართულად: „ელფოსტა ან პაროლი არასწორია.“ სხვა შეცდომები georgianError-ით.
   - ფორმის ქვემოთ პატარა ტექსტი: „ანგარიშს ადმინი ქმნის. პაროლი თუ დაგავიწყდა, ადმინს მიმართე.“
   - რეგისტრაციის ან magic link-ის ღილაკი აღარ უნდა იყოს.
   - sessionStorage 'auth-error'-ის ლოგიკა ამოიღე.
2. supabase.js: ამოიღე flowType: 'pkce' და detectSessionInUrl გახადე false. siteUrl() თუ აღარსად გამოიყენება, წაშალე.
3. main.jsx: ამოიღე URL hash-იდან access_token / error_description-ის დამუშავება. დატოვე მხოლოდ რენდერი.
4. .env.example: ამოიღე Redirect URLs-ის კომენტარი, დაამატე: „მომხმარებლებს ადმინი ქმნის Supabase → Authentication → Users → Add user (Auto Confirm User).“

შეამოწმე: AuthContext (არ შეცვალო) კვლავ სწორად იღებს session-ს და როლს onAuthStateChange-ით.
```

---

## აგენტი B — ID-ის ტიპის შეცდომა პროფილისა და წყვილის გვერდებზე

```
შენი ფაილები: src/pages/PlayerPage.jsx, src/pages/PairDetailPage.jsx.
სხვა ფაილს არ შეეხო.

პრობლემა: useParams() ID-ს სტრიქონად აბრუნებს ("3"), Supabase კი bigint-ს რიცხვად (3). ამიტომ `===` შედარება არასდროს ემთხვევა:
- PlayerPage.jsx: `people.find((item) => item.id === id)` და `statsRows.find((row) => row.player_id === id)` ყოველთვის null-ს აბრუნებს, და პროფილი ყოველთვის „მოთამაშე ვერ მოიძებნა“-ს აჩვენებს.
- PairDetailPage.jsx: `row.p1 === p1 && row.p2 === p2` არ ემთხვევა, და წყვილის ზედა ბარათები ცარიელია.

გააკეთე:
1. ორივე გვერდზე useParams-იდან მიღებული მნიშვნელობა გადააქციე რიცხვად: `const id = Number(params.id)`, `const p1 = Number(params.p1)`, `const p2 = Number(params.p2)`.
2. თუ Number.isInteger(id) false-ია (მაგ. /player/abc), მოთხოვნა არ გაგზავნო და პირდაპირ „ვერ მოიძებნა“ აჩვენე. წყვილზეც ასევე.
3. ყველა შედარება გააკეთე რიცხვებით. RPC პარამეტრებში (p_player) და .eq()/.or() ფილტრებში რიცხვი გადაეცი.
4. useEffect-ის დამოკიდებულებებში რიცხვითი მნიშვნელობები გამოიყენე.
5. ბოლოს მოძებნე ორივე ფაილში ნებისმიერი სხვა `=== id`, `=== p1`, `=== p2` შედარება და შეამოწმე, რომ ორივე მხარე რიცხვია.
```

---

## აგენტი C — პარტიის რედაქტირება, ისტორია, ბოლო შემადგენლობა

```
შენი ფაილები: src/pages/MatchesPage.jsx, src/pages/RecordPage.jsx, src/lib/audit.js.
სხვა ფაილს არ შეეხო.

ბაზაში უკვე დამატებულია:
- app_roles.display_name (text) — რედაქტორის სახელი;
- RPC ფუნქცია match_history(p_match bigint), რომელიც აბრუნებს: id, action ('INSERT'|'UPDATE'|'DELETE'), old_row jsonb, new_row jsonb, changed_at, changed_by_name. უკვე დალაგებულია changed_at desc. მხოლოდ editor/admin-ისთვის მუშაობს.

გააკეთე:
1. MatchesPage.jsx — რედაქტირების ფორმის ID-ები:
   <select>-ის onChange სტრიქონს აბრუნებს, ამიტომ draft.a1 და სხვ. სტრიქონები ხდება, `taken.has(player.id)` და `new Set(ids).size !== 4` შემოწმება კი არასწორად მუშაობს.
   onChange-ში მნიშვნელობა გადააქციე რიცხვად (ცარიელი → null). შეამოწმე, რომ draft-ში ყოველთვის რიცხვები ან null ინახება და ერთი მოთამაშის ორ ადგილას არჩევა ფორმაშივე იბლოკება.
2. MatchesPage.jsx — ისტორია:
   supabase.from('match_audit')... ჩაანაცვლე supabase.rpc('match_history', { p_match: selected.id }). ხელით დალაგება აღარ სჭირდება.
   თითო ჩანაწერში აჩვენე: მოქმედება, ვინ (changed_by_name), როდის, ცვლილებები.
3. audit.js:
   - auditTitle: 'INSERT' → „შეიქმნა“, 'UPDATE' → „შეიცვალა“, 'DELETE' → „წაიშალა“. თუ UPDATE-ში შეიცვალა მხოლოდ is_void false→true, დაწერე „გაუქმდა“, true→false — „აღდგა“.
   - auditLines: გამოტოვე ტექნიკური ველები: id, points, created_at, updated_at, created_by, updated_by. INSERT-ზე (old_row null) ცვლილებების ხაზები არ აჩვენო.
   - auditWhen გაამარტივე: row.changed_at.
   - ამოიღე გამოუყენებელი ალტერნატიული ველების სახელები (operation, diff, before, after და სხვ.), დატოვე მხოლოდ ის, რასაც match_history აბრუნებს.
4. RecordPage.jsx — „ბოლო შემადგენლობის გამეორება“:
   lastMatch-ის მოთხოვნას დაამატე .eq('is_void', false), რომ გაუქმებული პარტია არ აიღოს.
```

---

## დასრულების შემდეგ

1. `.env` შეავსე და `npm run dev` გაუშვი.
2. შედი პაროლით, ჩაწერე 3–4 სატესტო პარტია, გახსენი მოთამაშის პროფილი და წყვილის გვერდი, შეცვალე ერთი პარტია და ნახე ისტორია.
3. თუ ყველაფერი მუშაობს: `git commit`, შემდეგ GitHub-ზე push.
