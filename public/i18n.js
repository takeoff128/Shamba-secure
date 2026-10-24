// Shamba Secure language support. English is the source language; every other
// language is a dictionary of exact English strings (plus a few patterns for
// strings with numbers). A MutationObserver translates text the app renders later.
(function(){
  var LANGS = [
    { code:'en', label:'English',   short:'EN' },
    { code:'sw', label:'Kiswahili', short:'SW' }
  ];
  var D = { sw: {
"Active":"Hai","Add a debt":"Ongeza deni","Add a record":"Ongeza rekodi","Add a reminder":"Ongeza kikumbusho","Add a transaction":"Ongeza muamala","Add an animal":"Ongeza mnyama","Add an extra reminder for this lot":"Ongeza kikumbusho cha ziada kwa kundi hili","Add animal":"Ongeza mnyama","Add someone to your farm":"Ongeza mtu kwenye shamba lako","Add to farm":"Ongeza shambani","Amount":"Kiasi","Animal":"Mnyama","Animal type (optional)":"Aina ya mnyama (hiari)","Ask":"Uliza","Ask about the app or your farm":"Uliza kuhusu programu au shamba lako","Ask the Shamba Assistant":"Muulize Msaidizi wa Shamba","Ask the assistant":"Muulize msaidizi","At least 6 characters":"Angalau herufi 6","Back to log in":"Rudi kuingia","Bar graph":"Grafu ya miraba","Breed":"Aina ya mfugo","Breeding":"Kuzalisha","Broilers (28-day cycle to market)":"Kuku wa nyama (siku 28 hadi sokoni)","By continuing you agree to our":"Ukiendelea unakubali","Category":"Aina","Cattle":"Ng'ombe","Changing the start date moves every not-yet-sent reminder in the schedule below to match.":"Kubadilisha tarehe ya kuanza kunahamisha vikumbusho vyote ambavyo havijatumwa kwenye ratiba iliyo hapa chini.","Checking…":"Inakagua…","Chicken":"Kuku","Choose broilers or layers below — the right vaccination and feed-change schedule gets created automatically, dated from your start date.":"Chagua kuku wa nyama au wa mayai hapa chini — ratiba sahihi ya chanjo na kubadilisha chakula huundwa yenyewe, kuanzia tarehe yako ya kuanza.","Clear all":"Futa zote","Close":"Funga","Close menu":"Funga menyu","Closed":"Imefungwa","Compare lots, or look inside one. Figures come from the transactions and debts you tagged to each lot.":"Linganisha makundi, au tazama moja. Namba zinatoka kwenye miamala na madeni uliyoweka kwa kila kundi.","Confirm new password":"Thibitisha nenosiri jipya","Country (optional)":"Nchi (hiari)","Counts a sale as soon as it happens — including animals sold on credit, before the debt is even settled.":"Huhesabu mauzo mara tu yanapofanyika — pamoja na wanyama waliouzwa kwa mkopo, kabla deni halijalipwa.","Cow":"Ng'ombe","Create farm account":"Fungua akaunti ya shamba","Crop sales":"Mauzo ya mazao","Currency":"Sarafu","Currency, farm name, and the farm icon/logo are under Profile & farm settings in the menu.":"Sarafu, jina la shamba na nembo ya shamba ziko chini ya Wasifu na mipangilio ya shamba kwenye menyu.","Date":"Tarehe","Date acquired":"Tarehe ya kupatikana","Date incurred":"Tarehe ya deni","Date of birth":"Tarehe ya kuzaliwa","Debt balance":"Salio la madeni","Debt ledger":"Daftari la madeni","Debt settlement":"Malipo ya deni","Deceased":"Amekufa","Default schedule":"Ratiba ya kawaida","Details":"Maelezo","Due date (optional)":"Tarehe ya mwisho (hiari)","Edit debt":"Hariri deni","Edit details":"Hariri maelezo","Edit person":"Hariri mtu","Edit transaction":"Hariri muamala","Email":"Barua pepe","Email (optional)":"Barua pepe (hiari)","Email address":"Anwani ya barua pepe","Enter the phone number or email on your account and we'll text or email you a reset code, whichever you verified when you signed up.":"Weka nambari ya simu au barua pepe ya akaunti yako, nasi tutakutumia msimbo wa kuweka upya kwa SMS au barua pepe, kulingana na uliyothibitisha ulipojisajili.","Equipment":"Vifaa","Everyone on this farm gets an SMS on the date you pick. Debts with a due date already get one automatically.":"Kila mtu shambani atapata SMS siku utakayochagua. Madeni yenye tarehe ya mwisho tayari hupata moja kiotomatiki.","Expenses":"Matumizi","Farm":"Shamba","Farm icon":"Ikoni ya shamba","Farm logo preview":"Hakiki ya nembo ya shamba","Farm name":"Jina la shamba","Feed":"Chakula cha mifugo","Female":"Jike","Forgot your password?":"Umesahau nenosiri?","Full name":"Jina kamili","Full schedule for this lot":"Ratiba kamili ya kundi hili","Goat":"Mbuzi","Health / vet":"Afya / daktari wa mifugo","Herd snapshot":"Muhtasari wa mifugo","History":"Historia","I owe someone":"Namdai mtu","If that account exists, a code was sent. Enter it below with a new password.":"Ikiwa akaunti hiyo ipo, msimbo umetumwa. Uweke hapa chini pamoja na nenosiri jipya.","Income":"Mapato","Labor":"Vibarua","Layers (reared to point of lay, then ongoing)":"Kuku wa mayai (hadi wanapoanza kutaga, kisha kuendelea)","Livestock sales":"Mauzo ya mifugo","Log in":"Ingia","Log in to see how your farm is doing.":"Ingia uone shamba lako linavyoendelea.","Log out":"Toka","Lot":"Kundi","Lot (optional)":"Kundi (hiari)","Lot finances":"Fedha za kundi","Lot name / tag":"Jina / lebo ya kundi","Lot performance":"Utendaji wa makundi","Main menu":"Menyu kuu","Male":"Dume","Message":"Ujumbe","Milk / produce sales":"Mauzo ya maziwa / mazao","Money in":"Pesa zilizoingia","Money out":"Pesa zilizotoka","Mortality":"Vifo","Name":"Jina","New":"Mpya","New password":"Nenosiri jipya","No lots started yet.":"Hakuna kundi lililoanzishwa bado.","Not animal-related":"Haihusu mnyama","Not lot-specific":"Si ya kundi maalum","Not now":"Si sasa","Note (optional)":"Maelezo (hiari)","Notes":"Maelezo","Number lost":"Idadi iliyokufa","Number of birds":"Idadi ya ndege","Older records live here to keep your main screens tidy. Settled debts move here automatically.":"Rekodi za zamani ziko hapa ili skrini kuu ziwe nadhifu. Madeni yaliyolipwa huhamia hapa kiotomatiki.","Only the farm owner can change the farm's name, currency, country, and icon/logo.":"Mmiliki wa shamba pekee ndiye anaweza kubadilisha jina, sarafu, nchi na ikoni/nembo ya shamba.","Open menu":"Fungua menyu","Open profile and farm settings":"Fungua wasifu na mipangilio ya shamba","Optional":"Hiari","Or upload a logo image":"Au pakia picha ya nembo","Other":"Nyingine","Owed to you":"Unaodaiwa","Password":"Nenosiri","People on this farm":"Watu wa shamba hili","Person's name":"Jina la mtu","Phone (SMS) — unavailable":"Simu (SMS) — haipatikani","Phone number":"Nambari ya simu","Phone number or email":"Nambari ya simu au barua pepe","Phone or email":"Simu au barua pepe","Pick from contacts":"Chagua kutoka kwenye anwani","Pie chart":"Grafu ya duara","Pieces":"Idadi","Pig":"Nguruwe","Poultry":"Kuku","Production (milk/eggs)":"Uzalishaji (maziwa/mayai)","Profile & farm settings":"Wasifu na mipangilio ya shamba","Push notifications":"Arifa","Reason":"Sababu","Recent transactions":"Miamala ya karibuni","Record a loss":"Rekodi kifo","Record loss":"Rekodi kifo","Reminders also arrive by SMS. Notifications on this device are an extra alert, and work best once the app is added to your home screen.":"Vikumbusho pia huja kwa SMS. Arifa kwenye kifaa hiki ni tahadhari ya ziada, na hufanya kazi vizuri zaidi programu ikiongezwa kwenye skrini ya mwanzo.","Reminders sent to your phone":"Vikumbusho vilivyotumwa kwa simu yako","Remove image":"Ondoa picha","Resend code":"Tuma msimbo tena","Reset code":"Msimbo wa kuweka upya","SMS verification is temporarily unavailable":"Uthibitisho kwa SMS haupatikani kwa muda","Sales by animal type":"Mauzo kwa aina ya mnyama","Save changes":"Hifadhi mabadiliko","Save debt":"Hifadhi deni","Save details":"Hifadhi maelezo","Save farm settings":"Hifadhi mipangilio ya shamba","Save name":"Hifadhi jina","Save record":"Hifadhi rekodi","Save reminder":"Hifadhi kikumbusho","Save transaction":"Hifadhi muamala","Seeds & fertilizer":"Mbegu na mbolea","Send":"Tuma","Send a test notification":"Tuma arifa ya majaribio","Send due ones now":"Tuma zilizofika sasa","Send reset code":"Tuma msimbo wa kuweka upya","Settled debts":"Madeni yaliyolipwa","Sex":"Jinsia","Shamba Assistant":"Msaidizi wa Shamba","Sheep":"Kondoo","Show":"Onyesha","Hide":"Ficha","Sold":"Waliouzwa","Someone owes me":"Mtu ananidai","Species":"Spishi","Start a new chat":"Anza mazungumzo mapya","Start a new farm":"Anzisha shamba jipya","Start a new lot":"Anzisha kundi jipya","Start date":"Tarehe ya kuanza","Start date (day chicks arrive)":"Tarehe ya kuanza (siku vifaranga vinapofika)","Start lot & schedule reminders":"Anzisha kundi na upange vikumbusho","Status":"Hali","Stay on top of your farm":"Kuwa na udhibiti wa shamba lako","Tag / name":"Lebo / jina","Their phone number":"Nambari yao ya simu","Their phone number (optional — lets us text them a reminder)":"Nambari yao ya simu (hiari — inatuwezesha kuwatumia kikumbusho)","They'll log in with their own phone number and password, and see the same farm records as you.":"Wataingia kwa nambari yao ya simu na nenosiri, na kuona rekodi zile zile za shamba kama wewe.","This debt is settled — amount, direction, and animal details are locked. Mark it unsettled first to change those.":"Deni hili limelipwa — kiasi, mwelekeo na maelezo ya mnyama yamefungwa. Lirudishe kuwa bado halijalipwa kwanza ili kubadilisha.","Totals from every transaction and debt tagged to this lot — a sale counts as soon as it's recorded, even on credit, before the debt is settled.":"Jumla kutoka kwa kila muamala na deni lililowekwa kwa kundi hili — mauzo huhesabiwa mara yanaporekodiwa, hata kwa mkopo, kabla deni halijalipwa.","Track income, expenses and debts":"Fuatilia mapato, matumizi na madeni","Transactions":"Miamala","Transport":"Usafiri","Turn on notifications":"Washa arifa","Turn on notifications to get vaccination, feeding and payment reminders on this device, even when the app is closed.":"Washa arifa upate vikumbusho vya chanjo, ulishaji na malipo kwenye kifaa hiki, hata programu ikiwa imefungwa.","Type":"Aina","Type it again":"Iandike tena","Unknown":"Haijulikani","Upcoming & sent":"Zijazo na zilizotumwa","Value (optional, e.g. litres or kg)":"Thamani (hiari, mf. lita au kg)","Verification code":"Msimbo wa uthibitisho","Verify":"Thibitisha","Verify via":"Thibitisha kupitia","Verify your email":"Thibitisha barua pepe yako","Verify your phone number":"Thibitisha nambari yako ya simu","Veterinary":"Daktari wa mifugo","We sent a 6-digit code to":"Tumetuma msimbo wa tarakimu 6 kwa","We texted a 6-digit code to":"Tumetuma kwa SMS msimbo wa tarakimu 6 kwa","Weight":"Uzito","Welcome back":"Karibu tena","What for":"Kwa nini","Where things stand":"Hali ilivyo","You owe":"Unadaiwa","Your farm's money and livestock records, private to your farm.":"Rekodi za pesa na mifugo ya shamba lako, ni za siri kwa shamba lako.","Your herd":"Mifugo yako","Your lots":"Makundi yako","Your name":"Jina lako","Your password":"Nenosiri lako","Your question":"Swali lako","e.g. 200":"mf. 200","e.g. 3":"mf. 3","e.g. Check litter moisture":"mf. Kagua unyevu wa matandiko","e.g. Cow 014":"mf. Ng'ombe 014","e.g. Dewormed, or served by AI":"mf. Amepewa dawa ya minyoo, au amepandishwa kwa AI","e.g. Heat stress, disease":"mf. Joto kali, ugonjwa","e.g. Kamau Family Farm":"mf. Shamba la Familia ya Kamau","e.g. Kenya":"mf. Kenya","e.g. Lot A - August batch":"mf. Kundi A - la Agosti","e.g. Sold 3 bags of maize":"mf. Niliuza magunia 3 ya mahindi","e.g. Vaccinate the goats this week":"mf. Chanja mbuzi wiki hii","privacy policy":"sera ya faragha",
"Reminders":"Vikumbusho","Livestock":"Mifugo","Team":"Timu","Finance":"Fedha","Overview":"Muhtasari","Profile":"Wasifu",
"Net balance":"Salio halisi","Total in":"Jumla iliyoingia","Total out":"Jumla iliyotoka","Birds started":"Ndege walioanzishwa","Remaining":"Waliobaki","Edit":"Hariri","Remove":"Ondoa","All lots (compare)":"Makundi yote (linganisha)","All":"Zote","Farm-wide":"Shamba zima","More…":"Zaidi…","More...":"Zaidi...","Lot snapshot":"Muhtasari wa kundi","Restore to ledger":"Rudisha kwenye daftari","Mark settled":"Weka kuwa imelipwa","Mark unsettled":"Weka kuwa haijalipwa","Settled":"Imelipwa","Open":"Wazi","Close lot":"Funga kundi","Delete":"Futa","Cancel":"Ghairi","Save":"Hifadhi","Got it":"Nimeelewa","Owner":"Mmiliki","Worker":"Mfanyakazi","Broilers":"Kuku wa nyama","Layers":"Kuku wa mayai","Net":"Faida halisi","Income:":"Mapato:","Expenses:":"Matumizi:","Net:":"Faida halisi:",
"Saved":"Imehifadhiwa","Record saved":"Rekodi imehifadhiwa","Transaction saved":"Muamala umehifadhiwa","Transaction updated":"Muamala umesasishwa","Debt saved":"Deni limehifadhiwa","Debt updated":"Deni limesasishwa","Animal added":"Mnyama ameongezwa","Details saved":"Maelezo yamehifadhiwa","Reminder saved":"Kikumbusho kimehifadhiwa","Loss recorded":"Kifo kimerekodiwa","Status updated":"Hali imesasishwa","Name updated":"Jina limesasishwa","Added to the farm":"Ameongezwa shambani","Removed from the farm":"Ameondolewa shambani","Farm settings saved":"Mipangilio ya shamba imehifadhiwa","Farm icon updated":"Ikoni ya shamba imesasishwa","Farm logo updated":"Nembo ya shamba imesasishwa","Logo removed":"Nembo imeondolewa","Email verified":"Barua pepe imethibitishwa","Phone number verified":"Nambari ya simu imethibitishwa","A new code has been sent.":"Msimbo mpya umetumwa.","Verification code sent to your email":"Msimbo wa uthibitisho umetumwa kwa barua pepe yako","Verification code texted to your phone":"Msimbo wa uthibitisho umetumwa kwa simu yako","Password reset — log in with your new password.":"Nenosiri limewekwa upya — ingia kwa nenosiri jipya.","Settled — moved to History":"Imelipwa — imehamishiwa Historia","Restored to the debt ledger":"Imerudishwa kwenye daftari la madeni","No debts to clear":"Hakuna madeni ya kufuta","No transactions to clear":"Hakuna miamala ya kufuta","Nothing due today":"Hakuna kinachotakiwa leo","Something went wrong.":"Kuna hitilafu.","Could not reach the server. Check your connection and try again.":"Imeshindwa kufikia seva. Angalia mtandao wako ujaribu tena.","That took too long to respond. Check your connection and try again.":"Imechukua muda mrefu kujibu. Angalia mtandao wako ujaribu tena.","Fill in every field.":"Jaza kila sehemu.","Enter an amount first.":"Weka kiasi kwanza.","Enter a name.":"Weka jina.","Enter a name first.":"Weka jina kwanza.","Enter your name.":"Weka jina lako.","Enter a message.":"Weka ujumbe.","Pick a date.":"Chagua tarehe.","Pick a start date.":"Chagua tarehe ya kuanza.","Enter how many pieces.":"Weka idadi.","Enter how many were lost.":"Weka idadi iliyokufa.","Enter a phone number.":"Weka nambari ya simu.","Enter your phone number or email.":"Weka nambari ya simu au barua pepe.","Enter your phone number or email first.":"Weka nambari ya simu au barua pepe kwanza.","Enter your phone or email, and your password.":"Weka simu au barua pepe, na nenosiri lako.","Enter the code you were sent.":"Weka msimbo uliotumiwa.","Enter the code from your email.":"Weka msimbo kutoka kwa barua pepe yako.","Enter the code from your text message.":"Weka msimbo kutoka kwa ujumbe wako wa SMS.","Password must be at least 6 characters.":"Nenosiri lazima liwe na angalau herufi 6.","Passwords don't match.":"Manenosiri hayalingani.","Farm name cannot be empty.":"Jina la shamba haliwezi kuwa tupu.","Give this animal a tag or name.":"Mpe mnyama huyu lebo au jina.","Give this lot a name or tag.":"Lipe kundi hili jina au lebo.","Tag ID is required.":"Lebo inahitajika.","Add a short description.":"Weka maelezo mafupi.","Choose an image file.":"Chagua faili ya picha.","That file does not look like an image.":"Faili hiyo haionekani kuwa picha.","Could not read that file.":"Imeshindwa kusoma faili hiyo.","Could not open contacts.":"Imeshindwa kufungua anwani.","Notifications are turned off":"Arifa zimezimwa","Notifications turned off":"Arifa zimezimwa","Notifications are blocked for this site.":"Arifa zimezuiwa kwa tovuti hii.","Blocked in your device settings":"Imezuiwa kwenye mipangilio ya kifaa chako","Not supported on this browser":"Haiungwi mkono na kivinjari hiki","Not set up on this server yet":"Bado haijawekwa kwenye seva hii","Off. Turn on to get reminder alerts on this device.":"Imezimwa. Iwashe upate arifa za vikumbusho kwenye kifaa hiki.","Add the app to your Home Screen first":"Ongeza programu kwenye skrini ya mwanzo kwanza","Add Shamba Secure to your Home Screen":"Ongeza Shamba Secure kwenye skrini ya mwanzo","Verify & create account":"Thibitisha na ufungue akaunti","Reset password":"Weka upya nenosiri",
"Hi! I can show you how to do things in the app and look up your farm's numbers. What would you like to know?":"Habari! Naweza kukuonyesha jinsi ya kufanya mambo kwenye programu na kutafuta namba za shamba lako. Ungependa kujua nini?",
"AI assistant · read-only":"Msaidizi wa AI · husoma tu","Offline guide · app manual":"Mwongozo wa nje ya mtandao · kitabu cha programu",
"How do I record a sale?":"Nitarekodi mauzo vipi?","Who owes me money?":"Nani ananidai pesa?","How is my latest lot doing?":"Kundi langu la hivi karibuni linaendeleaje?","What reminders are coming up?":"Vikumbusho gani vinakuja?","Where did my settled debt go?":"Deni langu lililolipwa lilienda wapi?","Why are notifications blocked?":"Kwa nini arifa zimezuiwa?",
"New chat":"Mazungumzo mapya","Thinking":"Inafikiri","Checking your farm records":"Inakagua rekodi za shamba lako","Working out the numbers":"Inahesabu namba","Looking through the app guide":"Inatafuta kwenye mwongozo","Putting the steps together":"Inaandaa hatua","Language":"Lugha","Choose language":"Chagua lugha"
  }};
  // Patterns for strings that contain numbers or names.
  var P = { sw: [
    [/^Hi ([^!]+)! I can show you how to do things in the app and look up your farm's numbers\. What would you like to know\?$/, function(m){return 'Habari '+m[1]+'! Naweza kukuonyesha jinsi ya kufanya mambo kwenye programu na kutafuta namba za shamba lako. Ungependa kujua nini?';}],
    [/^Settled debts \((\d+)\)$/, function(m){return 'Madeni yaliyolipwa ('+m[1]+')';}],
    [/^Cleared (\d+) debts?$/, function(m){return 'Madeni '+m[1]+' yamefutwa';}],
    [/^Cleared (\d+) transactions?$/, function(m){return 'Miamala '+m[1]+' imefutwa';}],
    [/^Sent (\d+) reminder\(s\)$/, function(m){return 'Vikumbusho '+m[1]+' vimetumwa';}],
    [/^Lot started — (.*)$/, function(m){return 'Kundi limeanzishwa — '+tr(m[1]);}],
    [/^(\d+) of (\d+) birds remaining$/, function(m){return 'Ndege '+m[1]+' kati ya '+m[2]+' wamebaki';}],
    [/^Matures (.*)$/, function(m){return 'Hukomaa '+m[1];}],
    [/^Day (\d+)$/, function(m){return 'Siku '+m[1];}],
    [/^(\d+) pcs$/, function(m){return 'vipande '+m[1];}]
  ]};
  Object.assign(D.sw, {
"Lot started": "Kundi limeanzishwa",
"Set up the brooder at 32-35°C, start on chick/starter feed, and ensure clean water is always available.": "Andaa chumba cha vifaranga kwa 32-35°C, anza na chakula cha vifaranga, na hakikisha maji safi yapo kila wakati.",
"First vaccination": "Chanjo ya kwanza",
"Vaccinate against Newcastle/Gumboro disease as per your vet’s program. Watch for any birds off their feed.": "Chanja dhidi ya Newcastle/Gumboro kulingana na ratiba ya daktari wako wa mifugo. Angalia ndege wasiokula.",
"Mid-cycle check": "Ukaguzi wa katikati ya mzunguko",
"Weigh a sample of birds, check for a booster dose due around now, and watch mortality and feed intake closely.": "Pima uzito wa sampuli ya ndege, angalia kama chanjo ya nyongeza inahitajika sasa, na fuatilia vifo na ulaji wa chakula kwa karibu.",
"Switch to finisher feed & booster": "Badilisha kwa chakula cha kumalizia na chanjo ya nyongeza",
"Move the flock onto finisher feed and give the booster vaccination dose.": "Hamishia kundi kwenye chakula cha kumalizia na upe chanjo ya nyongeza.",
"End of cycle — ready for market": "Mwisho wa mzunguko — tayari sokoni",
"Birds should be near market weight. Plan sales or slaughter and start preparing the next lot.": "Ndege wanapaswa kuwa karibu na uzito wa soko. Panga mauzo au kuchinja na uanze kuandaa kundi lijalo.",
"Chicks arrive": "Vifaranga wanafika",
"Brooder at 32-35°C, chick mash, clean water always available. Marek’s vaccine is often already given at the hatchery on day 1.": "Chumba cha vifaranga 32-35°C, chakula cha vifaranga, maji safi kila wakati. Chanjo ya Marek mara nyingi hutolewa kiwandani siku ya 1.",
"Newcastle & Gumboro (1st dose)": "Newcastle na Gumboro (dozi ya 1)",
"Vaccinate against Newcastle Disease and Infectious Bursal Disease (Gumboro) as per your vet’s program.": "Chanja dhidi ya Newcastle na Gumboro kulingana na ratiba ya daktari wako wa mifugo.",
"Gumboro booster": "Chanjo ya nyongeza ya Gumboro",
"Second Gumboro dose. Watch feed intake and droppings closely this week.": "Dozi ya pili ya Gumboro. Angalia ulaji wa chakula na kinyesi kwa karibu wiki hii.",
"Fowl typhoid vaccine": "Chanjo ya typhoid ya kuku",
"Vaccinate against fowl typhoid. Deworm if this hasn’t been done yet.": "Chanja dhidi ya typhoid ya kuku. Wape dawa ya minyoo kama haijafanyika.",
"Switch to grower mash": "Badilisha kwa chakula cha kukuza",
"Move off chick mash onto grower mash as the pullets mature.": "Acha chakula cha vifaranga uhamie chakula cha kukuza wanapokomaa.",
"Fowl pox vaccine": "Chanjo ya ndui ya kuku",
"Wing-web vaccination against fowl pox.": "Chanjo ya ndui ya kuku kwenye ngozi ya bawa.",
"Newcastle booster": "Chanjo ya nyongeza ya Newcastle",
"Booster dose to maintain immunity through lay.": "Dozi ya nyongeza kudumisha kinga wakati wa kutaga.",
"Deworm": "Dawa ya minyoo",
"Routine deworming ahead of the switch to layer feed.": "Dawa ya kawaida ya minyoo kabla ya kubadilisha kwa chakula cha mayai.",
"Switch to layer mash": "Badilisha kwa chakula cha mayai",
"Move onto layer mash with higher calcium as point of lay approaches.": "Hamia chakula cha mayai chenye kalsiamu zaidi wakati wa kutaga unakaribia.",
"Point of lay — expect first eggs": "Kuanza kutaga — tarajia mayai ya kwanza",
"Most breeds begin laying around now. Start daily egg collection and recording — laying continues for many months from here.": "Aina nyingi huanza kutaga karibu wakati huu. Anza kukusanya na kurekodi mayai kila siku — utagaji huendelea kwa miezi mingi.",
"No losses recorded.": "Hakuna vifo vilivyorekodiwa.",
"No animals added yet.": "Hakuna mnyama aliyeongezwa bado.",
"No one added yet.": "Hakuna aliyeongezwa bado.",
"No reminders yet.": "Hakuna vikumbusho bado.",
"No open debts. Settled debts are kept in History.": "Hakuna madeni wazi. Madeni yaliyolipwa yako Historia.",
"Nothing here yet. When you mark a debt as settled it moves here.": "Hakuna kitu hapa bado. Ukiweka deni kuwa limelipwa, litahamia hapa.",
"No income or expenses tagged to this yet. Pick the lot when you save a transaction or debt.": "Hakuna mapato au matumizi yaliyowekwa kwa hili bado. Chagua kundi unapohifadhi muamala au deni.",
"Cows": "Ng'ombe",
"Goats": "Mbuzi",
"Chickens": "Kuku",
"Sheep": "Kondoo",
"Pigs": "Nguruwe",
"active": "hai",
"closed": "limefungwa",
"sold": "limeuzwa",
"Notifications": "Arifa",
"Allow": "Ruhusu",
"Birds sold": "Ndege waliouzwa"
});
  P.sw.push(
    [/^(.+) · (Owner|Worker)$/, function(m){ return m[1] + ' · ' + tr(m[2]); }],
    [/^(Broilers|Layers) · started (\S+) · Day (\d+) of (\d+)$/, function(m){ return tr(m[1]) + ' · zilianza ' + m[2] + ' · Siku ' + m[3] + ' ya ' + m[4]; }],
    [/^(\d+) sold$/, function(m){ return m[1] + ' waliouzwa'; }],
    [/^Day (\d+): (.+)$/, function(m){ return 'Siku ' + m[1] + ': ' + tr(m[2]); }],
    [/^(Broiler|Layer) lot "(.*)" — Day (\d+): (.+?)\. (.+)$/, function(m){ return (m[1]==='Layer'?'Kundi la kuku wa mayai':'Kundi la kuku wa nyama') + ' "' + m[2] + '" — Siku ' + m[3] + ': ' + tr(m[4]) + '. ' + tr(m[5]); }]
  );
  var lang = 'en';
  try { lang = localStorage.getItem('ss_lang') || ''; } catch(e){}
  if (!lang) { var nl = (navigator.language || '').slice(0,2).toLowerCase(); lang = D[nl] ? nl : 'en'; }
  if (!D[lang]) lang = 'en';

  function tr(s){
    if (lang === 'en') return s;
    var d = D[lang], t = d[s];
    if (t) return t;
    var ps = P[lang] || [];
    for (var i=0;i<ps.length;i++){ var m = s.match(ps[i][0]); if (m) return ps[i][1](m); }
    return s;
  }
  function translateString(raw){ // keeps surrounding whitespace
    var m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!m[2]) return raw;
    var core = m[2].replace(/\s+/g,' ');
    var out = tr(core), pre = '';
    if (out === core) { // emoji / symbol prefix, e.g. "💰 Finance"
      var pm = core.match(/^([^A-Za-z0-9]+\s)(.+)$/);
      if (pm) { var o2 = tr(pm[2]); if (o2 !== pm[2]) { pre = pm[1]; out = o2; } }
    }
    return out === core ? raw : m[1] + pre + out + m[3];
  }
  var ATTRS = ['placeholder','aria-label','title','alt'];
  var busy = false;
  function doText(n){
    var cur = n.data;
    var src = (n.__tr !== undefined && cur === n.__tr) ? n.__en : cur; // our own output, or new English from the app
    var out = lang === 'en' ? src : translateString(src);
    n.__en = src; n.__tr = out;
    if (cur !== out) n.data = out;
  }
  function doAttrs(el){
    for (var i=0;i<ATTRS.length;i++){
      var a = ATTRS[i]; if (!el.hasAttribute(a)) continue;
      var cur = el.getAttribute(a); el.__a = el.__a || {};
      var rec = el.__a[a];
      var src = (rec && cur === rec.tr) ? rec.en : cur;
      var out = lang === 'en' ? src : translateString(src);
      el.__a[a] = { en: src, tr: out };
      if (cur !== out) el.setAttribute(a, out);
    }
  }
  function walk(root){
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentNode && !skip(root.parentNode)) doText(root); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    doAttrs(root);
    var tw = document.createTreeWalker(root, 5, { acceptNode: function(n){
      if (n.nodeType === 1) return skip(n) ? 2 : 1; return 1; } });
    var n; while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function skip(el){ var t = el.nodeName; return t === 'SCRIPT' || t === 'STYLE' || el.hasAttribute && el.hasAttribute('data-notr'); }
  function run(root){ busy = true; try { walk(root || document.body); } finally { busy = false; } }

  var mo = new MutationObserver(function(list){
    if (busy) return;
    busy = true;
    try {
      list.forEach(function(m){
        if (m.type === 'characterData') { if (m.target.parentNode && !skip(m.target.parentNode)) doText(m.target); }
        else if (m.type === 'attributes') doAttrs(m.target);
        else m.addedNodes.forEach(function(n){ walk(n); });
      });
    } finally { busy = false; }
  });

  function renderButtons(){
    document.querySelectorAll('.lang-slot').forEach(function(slot){
      var cur = LANGS.filter(function(l){return l.code===lang;})[0];
      slot.innerHTML = '<button type="button" class="lang-btn" aria-haspopup="listbox" aria-expanded="false" data-notr>' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/></svg>' +
        '<span class="lang-code">' + cur.short + '</span></button>' +
        '<ul class="lang-menu" role="listbox" hidden data-notr>' + LANGS.map(function(l){
          return '<li role="option" tabindex="0" data-lang="' + l.code + '" aria-selected="' + (l.code===lang) + '"><span>' + l.label + '</span>' + (l.code===lang ? '<b aria-hidden="true">&#10003;</b>' : '') + '</li>';
        }).join('') + '</ul>';
      var btn = slot.querySelector('.lang-btn'); btn.setAttribute('aria-label', tr('Choose language'));
    });
  }
  function closeMenus(){ document.querySelectorAll('.lang-menu').forEach(function(m){ m.hidden = true; }); document.querySelectorAll('.lang-btn').forEach(function(b){ b.setAttribute('aria-expanded','false'); }); }
  function setLang(code){
    if (!D[code] && code !== 'en') return;
    lang = code; try { localStorage.setItem('ss_lang', code); } catch(e){}
    document.documentElement.lang = code;
    run(document.body); renderButtons(); closeMenus();
    document.dispatchEvent(new CustomEvent('langchange', { detail: code }));
  }
  document.addEventListener('click', function(e){
    var li = e.target.closest && e.target.closest('.lang-menu li');
    if (li) { setLang(li.getAttribute('data-lang')); return; }
    var btn = e.target.closest && e.target.closest('.lang-btn');
    if (btn) { var menu = btn.parentNode.querySelector('.lang-menu'); var open = menu.hidden; closeMenus(); menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); return; }
    closeMenus();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closeMenus();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.lang-menu li')) { e.preventDefault(); setLang(e.target.getAttribute('data-lang')); }
  });

  window.i18n = { t: tr, get lang(){ return lang; }, set: setLang, langs: LANGS };
  function init(){
    document.documentElement.lang = lang;
    renderButtons(); run(document.body);
    mo.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter: ATTRS });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
