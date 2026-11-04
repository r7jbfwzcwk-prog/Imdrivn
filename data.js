// DEMO DATA ONLY — fictional listings, not real vehicles or sellers. Local photos cropped from the IM DRIVN mockup; extras from Unsplash (royalty-free).
const U=id=>`https://images.unsplash.com/photo-${id}?w=900&q=60&auto=format&fit=crop`;
const POOL={supercars:['1544636331-e26879cd4d9b','1503376780353-7e6692767b70','1580273916550-e323be2ae537','1618843479313-40f8afb4b4d8','1583121274602-3e2820c69888'],
performance:['1552519507-da3b142c6e3d','1617814076367-b759c7d7e738','1606664515524-ed2f786a0bd6','1542362567-b07e54358753','1494976388531-d1058494cdd8'],
daily:['1549399542-7e3f8b79c341','1502877338535-766e1452684a','1553440569-bcc63803a83d','1492144534655-ae79c964c9d7','1525609004556-c46c7d6cf023']};
const SECTIONS={daily:'Daily',performance:'Performance',supercars:'Supercar'};
// sec, make, model, year, km, price, suburb, state, body, trans, img, handle, hoursAgo, likes
const RAW=[
['daily','Audi','SQ5',2021,38000,67900,'Melbourne','VIC','SUV','Auto','audi-sq5','drivn.melbourne',2,24],
['daily','Mercedes-Benz','A250',2019,52000,42500,'Sydney','NSW','Hatch','Auto','mercedes-a250','benz.lifestyle',4,18],
['daily','Volkswagen','Golf R',2020,46000,38990,'Brisbane','QLD','Hatch','Auto','vw-golf-r','german.auto',6,16],
['daily','Toyota','RAV4 Hybrid GX',2023,12000,44990,'Springwood','QLD','SUV','Auto',null,'daily.drivers',9,11],
['daily','Mazda','CX-5 Maxx',2021,38000,34500,'Parramatta','NSW','SUV','Auto',null,'zoom.zoom.au',12,9],
['daily','Kia','Sportage SX',2022,24000,36990,'Belconnen','ACT','SUV','Auto',null,'canberra.cars',20,7],
['performance','BMW','M4 Competition',2021,21000,149900,'Melbourne','VIC','Coupe','Auto','bmw-m4','m_performance',1,56],
['performance','Porsche','718 Cayman GT4',2022,8000,165000,'Sydney','NSW','Coupe','Manual','porsche-cayman-gt4','track.motors',3,42],
['performance','Honda','Civic Type R',2021,26000,59900,'Brisbane','QLD','Hatch','Manual','honda-civic-typer','revved.auto',5,31],
['performance','Toyota','GR Yaris',2021,32000,54500,'Geelong','VIC','Hatch','Manual',null,'gr.garage',8,27],
['performance','Ford','Mustang GT',2022,21000,74990,'Penrith','NSW','Coupe','Manual',null,'v8.syd',10,22],
['performance','Subaru','WRX STI',2019,48000,52990,'Joondalup','WA','Sedan','Manual',null,'boxer.boys',14,19],
['supercars','Lamborghini','Huracán EVO',2022,6400,489000,'Gold Coast','QLD','Coupe','Auto','lambo-huracan','drivn.exotics',1,98],
['supercars','Ferrari','488 Pista',2020,9100,675000,'Sydney','NSW','Coupe','Auto','ferrari-488','ferrari.collective',4,76],
['supercars','McLaren','720S',2019,15800,599000,'Melbourne','VIC','Coupe','Auto','mclaren-720s','mclaren.life',6,64],
['supercars','Porsche','911 Turbo S',2022,5200,529000,'Cottesloe','WA','Coupe','Auto',null,'perth.exotics',9,58],
['supercars','Audi','R8 V10 Performance',2021,11000,319000,'Broadbeach','QLD','Coupe','Auto',null,'r8.club.au',13,41],
['supercars','Aston Martin','Vantage',2020,19300,229000,'Unley','SA','Coupe','Auto',null,'adelaide.gt',22,33]];
const DEMO=RAW.map((r,i)=>{const[sec,make,model,year,km,price,suburb,state,body,trans,img,handle,ago,likes]=r;const p=POOL[sec];
 const first=img?`img/${img}.jpg`:U(p[i%p.length]);
 return{id:'d'+i,demo:true,sec,make,model,year,km,price,suburb,state,body,trans,handle,ago,likes,
 photos:[first,U(p[(i+1)%p.length]),U(p[(i+2)%p.length])],
 desc:`DEMO LISTING. Well-kept ${year} ${make} ${model}, ${trans.toLowerCase()}, ${km.toLocaleString('en-AU')} km. Full service history, two keys, registered in ${state}. Inspection welcome in ${suburb}. (Fictional listing for prototype purposes.)`,
 seller:'@'+handle};});
