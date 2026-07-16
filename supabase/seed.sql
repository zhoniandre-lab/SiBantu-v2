-- Initial platform store and demo catalog.
-- Safe to run more than once.

insert into stores(id, owner_id, is_platform_store, name, slug, description, phone, whatsapp, address_text, status, commission_rate)
values ('00000000-0000-4000-8000-000000000001', null, true, 'SiBantu Pasar Inpres', 'sibantu-pasar-inpres', 'Toko awal SiBantu di Pasar Inpres.', '085273139959', '6285273139959', 'Pasar Inpres, Desa Kepala Pasar, Kecamatan Kaur Selatan', 'active', 0)
on conflict (id) do update set name=excluded.name, phone=excluded.phone, whatsapp=excluded.whatsapp, address_text=excluded.address_text, status='active';

insert into categories(id, slug, name, emoji, sort_order) values
(1,'sayur','Sayur','🥬',1),(2,'ikan','Ikan','🐟',2),(3,'daging','Daging','🍗',3),(4,'sembako','Sembako','🍚',4),(5,'buah','Buah','🍎',5),(6,'bumbu','Bumbu','🌶️',6),(7,'rumah','Kebutuhan Rumah','🧼',7)
on conflict (id) do update set name=excluded.name, emoji=excluded.emoji, sort_order=excluded.sort_order;

insert into products(id, store_id, category_id, name, description, emoji, moderation_status, is_active) values
(1,'00000000-0000-4000-8000-000000000001',1,'Kacang Panjang','Segar untuk tumisan dan sayur.','🥬','approved',true),
(2,'00000000-0000-4000-8000-000000000001',1,'Bayam Hijau','Dipetik segar setiap pagi.','🌿','approved',true),
(3,'00000000-0000-4000-8000-000000000001',1,'Terong Ungu','Cocok untuk balado dan lalapan.','🍆','approved',true),
(4,'00000000-0000-4000-8000-000000000001',1,'Kangkung','Segar untuk tumis kangkung.','🥬','approved',true),
(5,'00000000-0000-4000-8000-000000000001',1,'Wortel','Manis dan renyah.','🥕','approved',true),
(6,'00000000-0000-4000-8000-000000000001',1,'Kentang','Pilihan serbaguna untuk lauk.','🥔','approved',true),
(10,'00000000-0000-4000-8000-000000000001',2,'Ikan Nila','Bisa dibersihkan sebelum dikirim.','🐟','approved',true),
(11,'00000000-0000-4000-8000-000000000001',2,'Ikan Lele','Segar, cocok digoreng atau dibakar.','🐟','approved',true),
(12,'00000000-0000-4000-8000-000000000001',2,'Ikan Tongkol','Daging padat untuk gulai dan sambal.','🐠','approved',true),
(13,'00000000-0000-4000-8000-000000000001',2,'Ikan Bandeng','Segar untuk presto atau bakar.','🐟','approved',true),
(20,'00000000-0000-4000-8000-000000000001',3,'Ayam Potong','Dapat dipotong sesuai permintaan.','🍗','approved',true),
(21,'00000000-0000-4000-8000-000000000001',3,'Daging Sapi','Untuk rendang, sop, dan semur.','🥩','approved',true),
(22,'00000000-0000-4000-8000-000000000001',3,'Telur Ayam','Telur segar pilihan.','🥚','approved',true),
(30,'00000000-0000-4000-8000-000000000001',4,'Beras Premium','Pulen dan bersih. Dijual utuh per kemasan 5 kg.','🍚','approved',true),
(31,'00000000-0000-4000-8000-000000000001',4,'Minyak Goreng','Minyak goreng kemasan.','🫗','approved',true),
(32,'00000000-0000-4000-8000-000000000001',4,'Gula Pasir','Butiran putih bersih.','🧂','approved',true),
(33,'00000000-0000-4000-8000-000000000001',4,'Tepung Terigu','Untuk gorengan dan kue.','🌾','approved',true),
(34,'00000000-0000-4000-8000-000000000001',4,'Mie Instan','Pilihan praktis untuk di rumah.','🍜','approved',true),
(40,'00000000-0000-4000-8000-000000000001',5,'Pisang','Matang alami dan manis.','🍌','approved',true),
(41,'00000000-0000-4000-8000-000000000001',5,'Jeruk','Segar dan manis-asam.','🍊','approved',true),
(42,'00000000-0000-4000-8000-000000000001',5,'Apel','Renyah untuk camilan keluarga.','🍎','approved',true),
(43,'00000000-0000-4000-8000-000000000001',5,'Pepaya','Matang dan manis.','🍈','approved',true),
(50,'00000000-0000-4000-8000-000000000001',6,'Cabai Merah','Pedas segar untuk sambal.','🌶️','approved',true),
(51,'00000000-0000-4000-8000-000000000001',6,'Bawang Merah','Bumbu wajib dapur.','🧅','approved',true),
(52,'00000000-0000-4000-8000-000000000001',6,'Bawang Putih','Harum dan bersih.','🧄','approved',true),
(53,'00000000-0000-4000-8000-000000000001',6,'Santan Instan','Praktis untuk gulai dan kolak.','🥥','approved',true),
(54,'00000000-0000-4000-8000-000000000001',6,'Kecap Manis','Pelengkap masakan keluarga.','🍶','approved',true),
(60,'00000000-0000-4000-8000-000000000001',7,'Sabun Cuci Piring','Membersihkan lemak membandel.','🧼','approved',true),
(61,'00000000-0000-4000-8000-000000000001',7,'Deterjen','Wangi dan bersih.','🫧','approved',true),
(62,'00000000-0000-4000-8000-000000000001',7,'Tisu','Lembut untuk kebutuhan rumah.','🧻','approved',true)
on conflict (id) do update set name=excluded.name, description=excluded.description, emoji=excluded.emoji, moderation_status='approved', is_active=true;

insert into product_variants(id, product_id, label, unit, unit_amount, price, stock, sku, is_default, is_active) values
(1,1,'1 ikat','ikat',1,5000,24,'SAY-KCP-IKAT',true,true),(2,2,'1 ikat','ikat',1,4000,18,'SAY-BYM-IKAT',true,true),(3,3,'1 kg','kg',1,24000,15,'SAY-TRG-KG',true,true),(4,4,'1 ikat','ikat',1,4000,20,'SAY-KKG-IKAT',true,true),(5,5,'1 kg','kg',1,28000,17,'SAY-WRT-KG',true,true),(6,6,'1 kg','kg',1,18000,22,'SAY-KTG-KG',true,true),
(10,10,'1 kg','kg',1,25000,12,'IKN-NLA-KG',true,true),(11,11,'1 kg','kg',1,18000,16,'IKN-LLE-KG',true,true),(12,12,'1 kg','kg',1,44000,9,'IKN-TKL-KG',true,true),(13,13,'1 kg','kg',1,28000,8,'IKN-BDG-KG',true,true),
(20,20,'1 kg','kg',1,45000,14,'DAG-AYM-KG',true,true),(21,21,'1 kg','kg',1,120000,7,'DAG-SAP-KG',true,true),(22,22,'1 kg','kg',1,28000,30,'DAG-TLR-KG',true,true),
(30,30,'Kemasan 5 kg','kemasan 5 kg',1,75000,25,'SMB-BRS-5KG',true,true),(31,31,'1 liter','liter',1,17000,28,'SMB-MYK-L',true,true),(32,32,'1 kg','kg',1,16000,19,'SMB-GLA-KG',true,true),(33,33,'1 kg','kg',1,13000,18,'SMB-TPG-KG',true,true),(34,34,'1 bungkus','bungkus',1,3500,60,'SMB-MIE-BKS',true,true),
(40,40,'1 sisir','sisir',1,15000,13,'BUA-PSG-SIS',true,true),(41,41,'1 kg','kg',1,36000,16,'BUA-JRK-KG',true,true),(42,42,'1 kg','kg',1,40000,11,'BUA-APL-KG',true,true),(43,43,'1 buah','buah',1,14000,10,'BUA-PPY-BUAH',true,true),
(50,50,'1 kg','kg',1,120000,20,'BMB-CBI-KG',true,true),(51,51,'1 kg','kg',1,40000,24,'BMB-BMR-KG',true,true),(52,52,'1 kg','kg',1,36000,21,'BMB-BPT-KG',true,true),(53,53,'1 bungkus','bungkus',1,6000,27,'BMB-STN-BKS',true,true),(54,54,'1 botol','botol',1,12000,19,'BMB-KCP-BTL',true,true),
(60,60,'1 pouch','pouch',1,11000,17,'RMH-SCP-PCH',true,true),(61,61,'800 gram','800 gram',1,18000,14,'RMH-DTR-800',true,true),(62,62,'1 pak','pak',1,10000,23,'RMH-TSU-PAK',true,true)
on conflict (id) do update set label=excluded.label, unit=excluded.unit, price=excluded.price, stock=excluded.stock, is_default=true, is_active=true;

select setval(pg_get_serial_sequence('categories','id'), (select max(id) from categories));
select setval(pg_get_serial_sequence('products','id'), (select max(id) from products));
select setval(pg_get_serial_sequence('product_variants','id'), (select max(id) from product_variants));
