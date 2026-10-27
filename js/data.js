/* Игровые данные: герои, враги, карты, сложности, достижения.
   Чистые данные без DOM — используются и в браузере, и в Node-тестах. */
(function (K) {
  'use strict';

  // Цены улучшений заданы явно: [1, 2, 3, 4, 5] для верхней и нижней ветки.
  const withCosts = (levels, costs) => levels.map((l, i) => Object.assign({ cost: costs[i] }, l));

  // fx-ключи: dmg(+), dmgMul(×), rateMul(×), range(+), splash(+), multi(+), chain(+), chainRange(+),
  // pierce(+), critC(+), critM(max), slow(max), slowDur(+), freezeC(+), freezeDur(max), stunC(+),
  // stunDur(max), burn(+), aoeAll, execute(max), income(+), bonusSlowed(+), bossFreeze,
  // для Свинки: heal(+) — лечение микропета за волну, petMax(+) — жизни микропета, shield(+) — блоки утечек за волну,
  // interest(+) — процент от своих монет за волну, interestCap(max)
  const HEROES = [
    {
      id: 'blaster', name: 'Бластер', role: 'Скорострельный универсал',
      desc: 'Компактная пушка с тремя стволами и радужными катушками. Засыпает коридор быстрыми зарядами.',
      price: 0, cost: 120, color: '#ff5fd2', rarity: 'Новичковый',
      base: { dmg: 8, rate: 3.2, range: 3.0, proj: 'bolt', projSpeed: 17 },
      top: withCosts([
        { name: 'Длинный прицел', icon: 'scope', desc: 'Дальность +0.4', fx: { range: 0.4 } },
        { name: 'Разгон катушек', icon: 'gear', desc: 'Скорость атаки +15%', fx: { rateMul: 1.15 } },
        { name: 'Веер стволов', icon: 'fan', desc: 'Стреляет по 3 целям, скорость +20%, дальность +0.6', fx: { multi: 2, rateMul: 1.2, range: 0.6 } },
        { name: 'Радужная очередь', icon: 'burst', desc: 'Скорость атаки +40%, дальность +0.5', fx: { rateMul: 1.4, range: 0.5 } },
        { name: 'Спектральный шторм', icon: 'star', desc: '5 целей разом, скорость +50%, дальность +0.8', fx: { multi: 2, rateMul: 1.5, range: 0.8, dmg: 2 } }
      ], [80, 150, 550, 800, 2500]),
      bottom: withCosts([
        { name: 'Плотный заряд', icon: 'dot', desc: 'Урон +3', fx: { dmg: 3 } },
        { name: 'Бронебойный сердечник', icon: 'pierce', desc: 'Пробивание брони +2', fx: { pierce: 2 } },
        { name: 'Перегрев', icon: 'flame', desc: 'Урон ×1.8, 15% шанс крита ×2', fx: { dmgMul: 1.8, critC: 0.15, critM: 2 } },
        { name: 'Плазменное ядро', icon: 'core', desc: 'Урон ×1.7, пробивание +4', fx: { dmgMul: 1.7, pierce: 4, range: 0.2 } },
        { name: 'Сверхновая', icon: 'nova', desc: 'Урон ×2, 30% шанс крита ×3', fx: { dmgMul: 2, critC: 0.15, critM: 3, rateMul: 1.1 } }
      ], [300, 450, 700, 1800, 3000])
    },
    {
      id: 'dragon', name: 'Диномайк', role: 'Взрывы по области',
      desc: 'Неоновый динозаврик с ящиком динамита за спиной. Швыряет шашки, которые взрываются в толпе. Видит летающих от рождения.',
      price: 900, cost: 220, color: '#b45cff', rarity: 'Необычный',
      base: { dmg: 16, rate: 0.9, range: 3.2, splash: 1.1, proj: 'orb', projSpeed: 9, aa: true },
      top: withCosts([
        { name: 'Острое зрение', icon: 'scope', desc: 'Дальность +0.4', fx: { range: 0.4 } },
        { name: 'Длинный фитиль', icon: 'fan', desc: 'Радиус взрыва +0.3', fx: { splash: 0.3 } },
        { name: 'Связка шашек', icon: 'burst', desc: 'Скорость +60%, дальность +0.8, урон ×0.85', fx: { rateMul: 1.6, range: 0.8, splash: 0.3, dmgMul: 0.85 } },
        { name: 'Двойной бросок', icon: 'twin', desc: 'Две цели, скорость +40%', fx: { multi: 1, rateMul: 1.4 } },
        { name: 'Динамитный ливень', icon: 'star', desc: 'Четыре цели, скорость +30%, дальность +0.8', fx: { multi: 2, rateMul: 1.3, range: 0.8 } }
      ], [150, 350, 600, 1100, 2300]),
      bottom: withCosts([
        { name: 'Порох покрепче', icon: 'dot', desc: 'Урон +6', fx: { dmg: 6 } },
        { name: 'Зажигательная смесь', icon: 'flame', desc: 'Горение 4 урона/с', fx: { burn: 4 } },
        { name: 'Нитро', icon: 'core', desc: 'Урон ×2, горение +8/с', fx: { dmgMul: 2, burn: 8 } },
        { name: 'Бронебойный заряд', icon: 'pierce', desc: 'Урон ×1.8, пробивание +5', fx: { dmgMul: 1.8, pierce: 5 } },
        { name: 'Мегабум', icon: 'nova', desc: 'Урон ×2.2, взрыв +0.5, горение +20/с', fx: { dmgMul: 2.2, splash: 0.5, burn: 20 } }
      ], [350, 500, 800, 2600, 4600])
    },
    {
      id: 'ice', name: 'Морозилка', role: 'Контроль и замедление',
      desc: 'Старая морозильная камера с инеем на дверце. Выдувает ледяную крошку, замедляет всё вокруг и иногда замораживает насмерть.',
      price: 0, cost: 140, color: '#7fe3ff', rarity: 'Обычный',
      base: { dmg: 4, rate: 1.1, range: 2.6, splash: 0.8, slow: 0.35, slowDur: 1.5, proj: 'shard', projSpeed: 12 },
      top: withCosts([
        { name: 'Холодный ореол', icon: 'scope', desc: 'Дальность +0.3', fx: { range: 0.3 } },
        { name: 'Долгий иней', icon: 'snow', desc: 'Замедление дольше на 0.5 с', fx: { slowDur: 0.5 } },
        { name: 'Метель', icon: 'fan', desc: 'Бьёт всех в радиусе, скорость +30%, дальность +0.5', fx: { aoeAll: true, rateMul: 1.3, range: 0.5 } },
        { name: 'Полярная ночь', icon: 'snow', desc: 'Замедление 50%, дальность +0.4, скорость +20%', fx: { slow: 0.5, range: 0.4, rateMul: 1.2 } },
        { name: 'Вечная мерзлота', icon: 'star', desc: '15% шанс заморозки, дальность +0.6, скорость +30%', fx: { freezeC: 0.15, freezeDur: 1, range: 0.6, rateMul: 1.3 } }
      ], [120, 350, 800, 1400, 2200]),
      bottom: withCosts([
        { name: 'Острые грани', icon: 'dot', desc: 'Урон +3', fx: { dmg: 3 } },
        { name: 'Хрупкость', icon: 'snow', desc: '8% шанс заморозки на 1 с', fx: { freezeC: 0.08, freezeDur: 1 } },
        { name: 'Ледяной шип', icon: 'pierce', desc: 'Урон ×3, заморозка +7%', fx: { dmgMul: 3, freezeC: 0.07 } },
        { name: 'Раскол', icon: 'core', desc: 'Урон ×2, +50% урона по замедленным', fx: { dmgMul: 2, bonusSlowed: 0.5 } },
        { name: 'Абсолютный ноль', icon: 'nova', desc: 'Урон ×2.5, заморозка +15% на 1.5 с, пробивание +6. Заморозка боссов: каждое попадание охлаждает босса, и он ненадолго замерзает', fx: { dmgMul: 2.5, freezeC: 0.15, freezeDur: 1.5, pierce: 6, bossFreeze: true } }
      ], [300, 450, 1100, 1800, 3400])
    },
    {
      id: 'prism', name: 'Реалганер', role: 'Дальний урон по одной цели',
      desc: 'Тяжёлая рельсовая пушка на треноге. Ставится только на препятствия, которые закрывают обзор, и стреляет поверх любых препятствий. Долго заряжается и пробивает лучом самых опасных. «Вижен» для невидимок покупается отдельно.',
      price: 1800, cost: 260, color: '#ffe36b', rarity: 'Легендарный',
      base: { dmg: 55, rate: 0.45, range: 4.5, proj: 'beam', target: 'strong', perch: true },
      top: withCosts([
        { name: 'Длинные рельсы', icon: 'scope', desc: 'Дальность +0.5', fx: { range: 0.5 } },
        { name: 'Быстрая зарядка', icon: 'gear', desc: 'Скорость атаки +15%, дальность +0.5', fx: { rateMul: 1.15, range: 0.5 } },
        { name: 'Расщепление', icon: 'fan', desc: 'Луч делится на 3 цели, скорость +40%, урон ×0.7, дальность +1.5', fx: { multi: 2, rateMul: 1.4, range: 1.5, dmgMul: 0.7 } },
        { name: 'Стробоскоп', icon: 'burst', desc: 'Скорость +50%, дальность +1.5', fx: { rateMul: 1.5, range: 1.5 } },
        { name: 'Калейдоскоп', icon: 'star', desc: 'Скорость +40%, дальность +1.5 (итого 10). Целей по-прежнему 3', fx: { rateMul: 1.4, range: 1.5 } }
      ], [100, 250, 1100, 1650, 3400]),
      bottom: withCosts([
        { name: 'Плотный луч', icon: 'dot', desc: 'Урон +25', fx: { dmg: 25 } },
        { name: 'Бронепрожиг', icon: 'pierce', desc: 'Пробивание брони +5', fx: { pierce: 5 } },
        { name: 'Фокус', icon: 'flame', desc: 'Урон ×2, 25% шанс крита ×2.5, дальность +0.5', fx: { dmgMul: 2, critC: 0.25, critM: 2.5, range: 0.5 } },
        { name: 'Белый жар', icon: 'core', desc: 'Урон ×1.8, пробивание +10, дальность +0.5', fx: { dmgMul: 1.8, pierce: 10, range: 0.5 } },
        { name: 'Солнечное копьё', icon: 'nova', desc: 'Урон ×2.5, добивает не-боссов ниже 15% здоровья, дальность +0.5 (итого 7)', fx: { dmgMul: 2.5, execute: 0.15, range: 0.5 } }
      ], [350, 800, 2400, 5200, 7800])
    },
    {
      id: 'storm', name: 'Громовержец', role: 'Цепные молнии',
      desc: 'Маленький повелитель грозы в короне из молний. Разряд прыгает от врага к врагу и иногда сбивает их с ног.',
      price: 1000, cost: 200, color: '#5ad8ff', rarity: 'Редкий',
      base: { dmg: 12, rate: 1.0, range: 3.0, chain: 3, chainRange: 1.8, stunC: 0.1, stunDur: 0.4, proj: 'bolt-chain' },
      top: withCosts([
        { name: 'Высокая мачта', icon: 'scope', desc: 'Дальность +0.4', fx: { range: 0.4 } },
        { name: 'Лишний прыжок', icon: 'chain', desc: 'Цепь +1 цель', fx: { chain: 1 } },
        { name: 'Разветвление', icon: 'fan', desc: 'Цепь +3, скорость +40%, дальность +0.6', fx: { chain: 3, rateMul: 1.4, range: 0.6 } },
        { name: 'Статика', icon: 'burst', desc: 'Скорость +40%, прыжок дальше на 0.6', fx: { rateMul: 1.4, chainRange: 0.6 } },
        { name: 'Грозовой фронт', icon: 'star', desc: 'Цепь +5, скорость +40%, дальность +0.8', fx: { chain: 5, rateMul: 1.4, range: 0.8 } }
      ], [200, 450, 1200, 1800, 4200]),
      bottom: withCosts([
        { name: 'Высокое напряжение', icon: 'dot', desc: 'Урон +6', fx: { dmg: 6 } },
        { name: 'Оглушающий разряд', icon: 'bolt', desc: 'Шанс оглушения +10%', fx: { stunC: 0.1 } },
        { name: 'Перегрузка', icon: 'flame', desc: 'Урон ×2.2, оглушение 0.8 с', fx: { dmgMul: 2.2, stunDur: 0.8 } },
        { name: 'Пробой изоляции', icon: 'pierce', desc: 'Урон ×1.8, пробивание +4', fx: { dmgMul: 1.8, pierce: 4 } },
        { name: 'Шаровая молния', icon: 'nova', desc: 'Урон ×2.5, оглушение 35% на 1.2 с', fx: { dmgMul: 2.5, stunC: 0.15, stunDur: 1.2 } }
      ], [500, 300, 900, 1500, 2300])
    },
    {
      id: 'piggy', name: 'Свинка', role: 'Доход и жизни микропета',
      desc: 'Заводная свинка-копилка. Не атакует: в начале каждой волны приносит монеты хозяину, а с верхней веткой — ещё и жизни микропету. Щит одноразовый. Не больше 4 Свинок у одного игрока.',
      price: 400, cost: 160, color: '#ffb347', rarity: 'Необычный',
      base: { dmg: 0, rate: 0, range: 1.6, proj: 'none', income: 30, passive: true, maxPerPlayer: 4 },
      top: withCosts([
        { name: 'Пластырь', icon: 'heal', desc: 'В начале каждой волны лечит микропета на 1', fx: { heal: 1 } },
        { name: 'Тёплый свитер', icon: 'heart', desc: 'Жизни микропета +5 (с начала следующей волны)', fx: { petMax: 5 } },
        { name: 'Аптечка', icon: 'heal', desc: 'Лечение в начале волны +2, жизни +5; доход +60', fx: { heal: 2, petMax: 5, income: 60 } },
        { name: 'Пушистый щит', icon: 'shield', desc: 'Одноразовый щит: блокирует 2 сущности, дошедшие до микропета; доход +100', fx: { shield: 2, income: 100 } },
        { name: 'Ангел-хранитель', icon: 'star', desc: 'Жизни +15, лечение +3, ещё 3 заряда щита; доход +160 (с 2 нижними улучшениями — 450 за волну)', fx: { petMax: 15, heal: 3, shield: 3, income: 160 } }
      ], [150, 300, 700, 1300, 2600]),
      bottom: withCosts([
        { name: 'Звонкая щель', icon: 'coin', desc: 'Доход +40 за волну', fx: { income: 40 } },
        { name: 'Вклад', icon: 'coin', desc: 'Доход +60 за волну', fx: { income: 60 } },
        { name: 'Копилка побольше', icon: 'core', desc: 'Доход +120 за волну', fx: { income: 120 } },
        { name: 'Золотая жила', icon: 'burst', desc: 'Доход +200 за волну', fx: { income: 200 } },
        { name: 'Джекпот', icon: 'nova', desc: 'Доход +350 за волну — итого 800 за волну', fx: { income: 350 } }
      ], [120, 300, 800, 1500, 3000])
    },
    {
      id: 'garage', name: 'Гараж', role: 'Машины давят сущностей',
      desc: 'Здание, а не пушка. Пока идёт волна, раз в 30 с выпускает машину со стороны микропета: она едет по дороге навстречу сущностям и давит их. Если у сущности жизней больше, чем у машины, сущность теряет столько, сколько было у машины, а машина сгорает. Не больше 4 гаражей у одного игрока.',
      price: 1400, cost: 300, color: '#7cff6b', rarity: 'Эпический',
      base: { dmg: 0, rate: 0, range: 1.2, proj: 'none', passive: true, garage: true, carHp: 60, carInt: 30, carSpeed: 1.7 },
      top: withCosts([
        { name: 'Смена водителей', icon: 'gear', desc: 'Машина каждые 29 с', fx: { carInt: -1 } },
        { name: 'Конвейер', icon: 'gear', desc: 'Машина каждые 28 с, скорость машины +15%', fx: { carInt: -1, carSpeed: 0.25 } },
        { name: 'Стрелок', icon: 'scope', desc: 'На машине едет стрелок: урон 10, 1.2 выстр./с, радиус 2.5. Машина каждые 27 с', fx: { carInt: -1, gunDmg: 10, gunRate: 1.2, gunRange: 2.5 } },
        { name: 'Пулемёт', icon: 'burst', desc: 'Урон стрелка ×1.6, скорострельность ×1.5. Машина каждые 26 с', fx: { carInt: -1, gunDmgMul: 1.6, gunRateMul: 1.5 } },
        { name: 'Конвой', icon: 'star', desc: 'Урон стрелка ×1.6, радиус +1. Машина каждые 25 с', fx: { carInt: -1, gunDmgMul: 1.6, gunRange: 1 } }
      ], [150, 300, 900, 1600, 3200]),
      bottom: withCosts([
        { name: 'Бампер', icon: 'shield', desc: 'Жизни машины +40', fx: { carHp: 40 } },
        { name: 'Бронелисты', icon: 'shield', desc: 'Жизни машины +60', fx: { carHp: 60 } },
        { name: 'Бронефургон', icon: 'heart', desc: 'Жизни машины ×2', fx: { carHpMul: 2 } },
        { name: 'Броневик', icon: 'heart', desc: 'Жизни машины ×1.8', fx: { carHpMul: 1.8 } },
        { name: 'Танк', icon: 'nova', desc: 'Машина становится танком: жизни ×2 и пушка — урон 150 по области, радиус 3.5, но выстрел лишь раз в 3.5 с', fx: { carHpMul: 2, tank: true, tankDmg: 150, tankRate: 1 / 3.5, tankRange: 3.5, tankSplash: 1.2 } }
      ], [120, 300, 900, 1800, 3800])
    }
  ];
  // Лимиты построек: гаражей на игрока и всего башен на игрока (зависит от числа игроков)
  K.GARAGE_MAX = 4;
  // Игроки (по подтверждённому сервером тегу), которым сервер выдаёт все башни
  K.GIFT_ALL_TAGS = ['5U6', 'U9M'];
  K.towerCap = n => ({ 1: 25, 2: 20, 3: 18, 4: 15 })[Math.max(1, Math.min(4, n || 1))];

  const SKILLS = {
    vision: { name: 'Вижен', cost: 100, desc: 'Башня видит невидимых сущностей и может их атаковать.' },
    aa: { name: 'ПВО', cost: 90, desc: 'Башня захватывает летающие цели.' }
  };

  // Враги. armor — плоское снижение урона (пробивание уменьшает броню).
  const ENEMIES = {
    normal: { name: 'Скрич', hp: 30, speed: 1.4, armor: 0, reward: 6, dmg: 1, cost: 1, desc: 'Тень с белыми глазами. Ничего особенного — пока их мало.' },
    fast: { name: 'Тимоти', hp: 18, speed: 2.6, armor: 0, reward: 5, dmg: 1, cost: 0.8, desc: 'Мелкий ползун. Очень быстрый, очень хрупкий.' },
    armored: { name: 'Фигура', hp: 85, speed: 0.9, armor: 3, reward: 12, dmg: 2, cost: 2.4, desc: 'Медленная туша в железных пластинах. Нужна бронебойность.' },
    ghost: { name: 'Шедоу', hp: 34, speed: 1.5, armor: 0, reward: 9, dmg: 1, cost: 1.5, invisible: true, desc: 'Невидим. Атаковать могут только башни с «Виженом».' },
    flyer: { name: 'Айз', hp: 38, speed: 1.7, armor: 0, reward: 9, dmg: 1, cost: 1.5, flying: true, desc: 'Летающий глаз. Нужна ПВО.' },
    jumper: { name: 'Раш', hp: 42, speed: 1.3, armor: 1, reward: 9, dmg: 1, cost: 1.4, dash: 2.4, desc: 'На отмеченных участках маршрута делает рывок.' },
    elite: { name: 'Сик', hp: 200, speed: 1.0, armor: 3, reward: 30, dmg: 3, cost: 6, heal: 0.1, desc: 'Элита. Каждые 4 с лечит сущностей рядом на 10%.' },
    boss: { name: 'Ковтоп', hp: 1300, speed: 0.55, armor: 6, reward: 250, dmg: 10, cost: 40, boss: true, desc: 'Хозяин отеля с телевизором вместо головы. Призывает Тимоти, а на половине здоровья экран краснеет и он ускоряется.' }
  };

  const DIFFS = {
    easy: { name: 'Легко', waves: 20, hpMul: 0.8, countMul: 0.8, speedMul: 0.9, unlockShift: 3, startCoins: 300, petHp: 40, eliteRate: 0.5, winCoins: 100, winXp: 30, dmgPerCoin: 5, bonusBase: 180 },
    normal: { name: 'Нормально', waves: 30, hpMul: 1.0, countMul: 1.0, speedMul: 1.0, unlockShift: 0, startCoins: 260, petHp: 30, eliteRate: 1, winCoins: 200, winXp: 60, dmgPerCoin: 10, bonusBase: 150 },
    hard: { name: 'Тяжело', waves: 40, hpMul: 1.15, countMul: 1.15, speedMul: 1.08, unlockShift: -2, startCoins: 260, petHp: 25, eliteRate: 1.4, winCoins: 300, winXp: 100, dmgPerCoin: 15, bonusBase: 120 },
    duel: { name: 'Дуэль', waves: Infinity, hpMul: 1.0, countMul: 1.0, speedMul: 1.0, unlockShift: -1, startCoins: 1000, petHp: 25, eliteRate: 1.1, winCoins: 0, winXp: 0, dmgPerCoin: 15, bonusBase: 120 }
  };
  // Бесконечный режим — продолжение «Тяжело»: первые 40 волн те же, дальше без конца
  // волны как на «Тяжело», а монеты — как на «Нормально»; стартовых монет 500
  DIFFS.endless = Object.assign({}, DIFFS.hard, { name: 'Бесконечный', waves: Infinity, winCoins: 0, winXp: 0, endless: true, startCoins: 500, dmgPerCoin: DIFFS.normal.dmgPerCoin, bonusBase: DIFFS.normal.bonusBase });
  // Дуэль дороже: установка +10%, улучшения 1–5 уровня +10/15/20/25/30%
  const DUEL_PLACE = 1.1, DUEL_UP = [1.1, 1.15, 1.2, 1.25, 1.3];
  K.placeCost = (heroId, mode) => { const c = K.HERO[heroId].cost; return mode === 'duel' ? Math.round(c * DUEL_PLACE) : c; };
  K.upCost = (node, lvl, mode) => mode === 'duel' ? Math.round(node.cost * DUEL_UP[Math.max(0, Math.min(4, lvl))]) : node.cost;
  // Здоровье Ковтопа на боссовых волнах основной части (одинаково для всех сложностей)
  K.BOSS_HP = { 10: 1000, 20: 5000, 30: 13000, 40: 25000 };

  // Карты. Координаты: x ∈ [-5,5] (ширина), z ∈ [-10,9.5] (сверху вниз), y — высота.
  // paths — один или несколько маршрутов (развилки). dash — индексы отрезков, где рывок Раша.
  const MAPS = [
    {
      id: 'lobby', name: 'Заброшенный холл', cat: 'Отель', stars: 1, theme: 'lobby',
      blurb: 'Тихий холл с ковровой дорожкой. Простой маршрут для разминки.',
      paths: [[[0, -9.6], [0, -6], [-3.4, -6], [-3.4, -0.8], [3.4, -0.8], [3.4, 4], [0, 4], [0, 8.2]]],
      dash: [1, 3], obstacles: 18, palette: ['#3a1a1f', '#c9a35a', '#e8d9b0']
    },
    {
      id: 'corridor', name: 'Длинный коридор', cat: 'Отель', stars: 2, theme: 'corridor',
      blurb: 'Бесконечные двери и зигзаги. Много углов для удобных позиций.',
      paths: [[[-3.8, -9.6], [-3.8, -7.2], [3.8, -7.2], [3.8, -4.2], [-3.8, -4.2], [-3.8, -1.2], [3.8, -1.2], [3.8, 1.8], [-3.8, 1.8], [-3.8, 4.8], [0, 4.8], [0, 8.2]]],
      dash: [2, 4, 6], obstacles: 18, palette: ['#2b2216', '#e0b35c', '#7a1d1d']
    },
    {
      id: 'mirrors', name: 'Зал зеркал', cat: 'Отель', stars: 3, theme: 'mirrors',
      blurb: 'Маршрут раздваивается. Густой туман и больше невидимок.',
      paths: [
        [[0, -9.6], [0, -6.6], [-3.6, -6.6], [-3.6, 2.6], [0, 2.6], [0, 8.2]],
        [[0, -9.6], [0, -6.6], [3.6, -6.6], [3.6, 2.6], [0, 2.6], [0, 8.2]]
      ],
      dash: [3], obstacles: 18, ghostBoost: 1.6, palette: ['#1a1430', '#b8a6ff', '#e6e0ff']
    },
    {
      id: 'mine', name: 'Заброшенная шахта', cat: 'Шахты', stars: 3, theme: 'mine',
      blurb: 'Рельсы спускаются по уступам. Узкие проходы и перепады высот.',
      paths: [[[-3.8, -9.6, 1.4], [-3.8, -5.4, 1.4], [0.2, -5.4, 0.8], [0.2, -2.4, 0.3], [3.8, -2.4, 0], [3.8, 2.4, 0], [-1.6, 2.4, -0.2], [-1.6, 5.4, -0.2], [0, 5.4, -0.2], [0, 8.2, -0.2]]],
      dash: [2, 4, 5], obstacles: 18, palette: ['#2a1d14', '#ff9a3d', '#8a6a4a']
    },
    {
      id: 'crystal', name: 'Кристальные туннели', cat: 'Шахты', stars: 4, theme: 'crystal',
      blurb: 'Светящиеся минералы и развилка в глубине туннелей.',
      paths: [
        [[-3, -9.6], [-3, -5.4], [0, -3.2], [-3, -0.4], [-3, 4], [0, 5.8], [0, 8.2]],
        [[-3, -9.6], [-3, -5.4], [3, -5.4], [3, 4], [0, 5.8], [0, 8.2]]
      ],
      dash: [2, 3], obstacles: 18, palette: ['#0d1a2e', '#38f2e0', '#e05cff']
    },
    {
      id: 'depths', name: 'Глубины шахт', cat: 'Шахты', stars: 5, theme: 'depths',
      blurb: 'Длинный серпантин над лавой. Темно, а на раскалённых участках враги ускоряются.',
      paths: [[[4, -9.6], [4, -7.6], [-4, -7.6], [-4, -5], [4, -5], [4, -2.4], [-4, -2.4], [-4, 0.2], [4, 0.2], [4, 2.8], [-4, 2.8], [-4, 5.4], [0, 5.4], [0, 8.2]]],
      dash: [2, 6, 10], hazard: [1, 5, 9], obstacles: 18, palette: ['#120a08', '#ff4d1f', '#ffb15c']
    }
  ];

  const PLAYER_COLORS = ['#45e0c0', '#ff6b6b', '#ffd25e', '#8f8bff'];

  // group — раздел в списке; secret — скрыто до получения
  const ACHIEVEMENTS = [
    // Прохождение
    { id: 'first_wave', group: 'Прохождение', name: 'Первая волна', desc: 'Пережить первую волну', coins: 20, xp: 20 },
    { id: 'win_easy', group: 'Прохождение', name: 'Новичок отеля', desc: 'Победить на сложности «Легко»', coins: 50, xp: 60 },
    { id: 'win_normal', group: 'Прохождение', name: 'Постоялец', desc: 'Пройти «Нормально»', coins: 100, xp: 120 },
    { id: 'win_hard', group: 'Прохождение', name: 'Хозяин ключей', desc: 'Победить на сложности «Тяжело»', coins: 200, xp: 250 },
    { id: 'all_maps', group: 'Прохождение', name: 'Ревизор', desc: 'Победить на каждой из шести карт', coins: 200, xp: 200 },
    { id: 'hard_all_maps', group: 'Прохождение', name: 'Управляющий', desc: 'Победить на «Тяжело» на всех шести картах', coins: 500, xp: 500 },
    { id: 'perfect', group: 'Прохождение', name: 'Ни царапины', desc: 'Победить, не пропустив к микропету ни одной сущности', coins: 120, xp: 120 },
    { id: 'perfect_hard', group: 'Прохождение', name: 'Идеальный сервис', desc: 'Победить на «Тяжело», не пропустив ни одной сущности', coins: 400, xp: 400 },
    { id: 'clutch', group: 'Прохождение', name: 'На волоске', desc: 'Победить, когда у микропета осталось не больше 3 жизней', coins: 80, xp: 80 },
    { id: 'mono', group: 'Прохождение', name: 'Один в поле воин', desc: 'Победить, строя башни только одного вида', coins: 150, xp: 150 },
    // Бесконечный режим
    { id: 'endless_open', group: 'Бесконечный режим', name: 'Дверь без номера', desc: 'Открыть бесконечный режим', coins: 50, xp: 50 },
    { id: 'endless_25', group: 'Бесконечный режим', name: 'Глубже некуда', desc: 'Дожить до 25-й волны в бесконечном режиме', coins: 150, xp: 200 },
    { id: 'endless_50', group: 'Бесконечный режим', name: 'Подвал отеля', desc: 'Дожить до 50-й волны в бесконечном режиме', coins: 300, xp: 300 },
    { id: 'endless_100', group: 'Бесконечный режим', name: 'Сотый этаж', desc: 'Дожить до 100-й волны в бесконечном режиме', coins: 800, xp: 800 },
    // Сражения
    { id: 'kills_1000', group: 'Сражения', name: 'Тысяча теней', desc: 'Уничтожить 1000 сущностей', coins: 120, xp: 150 },
    { id: 'kills_10000', group: 'Сражения', name: 'Ночная смена', desc: 'Уничтожить 10 000 сущностей', coins: 400, xp: 400 },
    { id: 'boss_1', group: 'Сражения', name: 'Выключить телевизор', desc: 'Победить Ковтопа', coins: 80, xp: 80 },
    { id: 'boss_25', group: 'Сражения', name: 'Мастер по ремонту ТВ', desc: 'Победить Ковтопа 25 раз', coins: 300, xp: 300 },
    { id: 'waves_100', group: 'Сражения', name: 'Сотня волн', desc: 'Отбить 100 волн во всех матчах вместе', coins: 100, xp: 100 },
    { id: 'waves_1000', group: 'Сражения', name: 'Бессонница', desc: 'Отбить 1000 волн во всех матчах вместе', coins: 400, xp: 400 },
    // Башни
    { id: 'all_heroes', group: 'Башни', name: 'Полный отряд', desc: 'Открыть всех героев', coins: 150, xp: 150 },
    { id: 'max_tier', group: 'Башни', name: 'Пятый уровень', desc: 'Прокачать ветку башни до пятого уровня', coins: 60, xp: 80 },
    { id: 'max_tier_all', group: 'Башни', name: 'Мастер на все руки', desc: 'Прокачать до пятого уровня ветку каждого героя', coins: 300, xp: 300 },
    { id: 'tank', group: 'Башни', name: 'Тяжёлая техника', desc: 'Превратить машины Гаража в танки', coins: 80, xp: 80 },
    { id: 'garage_100', group: 'Башни', name: 'Таксопарк', desc: 'Задавить машинами Гаража 100 сущностей', coins: 120, xp: 120 },
    { id: 'piggy_10k', group: 'Башни', name: 'Копилка', desc: 'Получить от Свинок 10 000 монет', coins: 150, xp: 150 },
    // Мультиплеер
    { id: 'duel_win', group: 'Вместе', name: 'Первая дуэль', desc: 'Выиграть дуэль', coins: 60, xp: 80 },
    { id: 'duel_10', group: 'Вместе', name: 'Дуэлянт', desc: 'Выиграть 10 дуэлей', coins: 200, xp: 200 },
    { id: 'team_win', group: 'Вместе', name: 'Вместе теплее', desc: 'Победить в командном режиме', coins: 80, xp: 100 },
    { id: 'team_10', group: 'Вместе', name: 'Командный дух', desc: 'Победить в командном режиме 10 раз', coins: 200, xp: 200 },
    // Аккаунт
    { id: 'games_10', group: 'Аккаунт', name: 'Завсегдатай', desc: 'Сыграть 10 матчей', coins: 40, xp: 40 },
    { id: 'games_100', group: 'Аккаунт', name: 'Ключ под ковриком', desc: 'Сыграть 100 матчей', coins: 250, xp: 250 },
    { id: 'level_10', group: 'Аккаунт', name: 'Почётный гость', desc: 'Достичь 10-го уровня аккаунта', coins: 100, xp: 0 },
    { id: 'level_25', group: 'Аккаунт', name: 'Легенда отеля', desc: 'Достичь 25-го уровня аккаунта', coins: 300, xp: 0 },
    { id: 'rich', group: 'Аккаунт', name: 'Сейф портье', desc: 'Накопить 5000 монет на аккаунте', coins: 100, xp: 100 },
    { id: 'time_1h', group: 'Аккаунт', name: 'Свой человек', desc: 'Провести в игре 1 час', coins: 80, xp: 100 },
    { id: 'time_10h', group: 'Аккаунт', name: 'Прописка', desc: 'Провести в игре 10 часов', coins: 300, xp: 300 },
    // Тайные
    { id: 'secret_title', hint: 'Название игры что-то скрывает', group: 'Тайные', name: 'Ковтоп видит тебя', desc: 'Найти тайну в названии игры', coins: 30, xp: 40, secret: true },
    { id: 'secret_morse', hint: 'Лампы мигают не просто так', group: 'Тайные', name: 'Сигнал из шахты', desc: 'Расшифровать мигание лампы и ввести код в магазине', coins: 100, xp: 100, secret: true },
    { id: 'secret_eye', hint: 'Присмотритесь к экрану Ковтопа', group: 'Тайные', name: 'Взгляд Ковтопа', desc: 'Запомнить пять чисел с экрана Ковтопа и ввести их в магазине', coins: 150, xp: 150, secret: true },
    { id: 'secret_guest', hint: 'Иногда достаточно просто открыть дверь', group: 'Тайные', name: 'Гостеприимство', desc: 'Пережить волну, не построив ни одной башни', coins: 60, xp: 60, secret: true },
    { id: 'secret_checkout', hint: 'Не всем постояльцам здесь рады', group: 'Тайные', name: 'Выселение', desc: 'Проиграть, не пережив ни одной волны', coins: 20, xp: 20, secret: true },
    { id: 'secret_3am', hint: 'Ковтоп не спит по ночам', group: 'Тайные', name: 'Три часа ночи', desc: 'Сыграть матч между 3:00 и 4:00 ночи', coins: 66, xp: 66, secret: true },
    { id: 'secret_impostor', hint: 'А кем бы стать вам?', group: 'Тайные', name: 'Самозванец', desc: 'Взять никнейм «Ковтоп»', coins: 40, xp: 40, secret: true },
    { id: 'secret_close', hint: 'Ещё шаг — и было бы поздно', group: 'Тайные', name: 'В последний момент', desc: 'Победить Ковтопа, когда ему оставалось меньше 3 секунд до микропета', coins: 120, xp: 120, secret: true },
    { id: 'secret_piggy', hint: 'Хрю. Хрю. Хрю. Хрю.', group: 'Тайные', name: 'Свиноферма', desc: 'Поставить в одном матче четыре Свинки', coins: 50, xp: 50, secret: true },
    { id: 'secret_rush', hint: 'Пробки бывают и в отеле', group: 'Тайные', name: 'Час пик', desc: 'Одной машиной Гаража задавить 5 сущностей', coins: 80, xp: 80, secret: true },
    { id: 'secret_all', hint: 'Соберите всё остальное', group: 'Тайные', name: 'Все ключи отеля', desc: 'Получить все остальные достижения', coins: 1000, xp: 1000, secret: true }
  ];


  const DEMO_PLAYERS = [
    { nick: 'Лампочка_404', level: 31, endless: 58, duelWins: 140, time: 412000 },
    { nick: 'Ночной портье', level: 27, endless: 49, duelWins: 96, time: 300100 },
    { nick: 'КлючОт1013', level: 24, endless: 61, duelWins: 51, time: 254000 },
    { nick: 'Шахтёр_Ди', level: 22, endless: 37, duelWins: 120, time: 188000 },
    { nick: 'Микропетовед', level: 19, endless: 33, duelWins: 22, time: 350000 },
    { nick: 'Тихий_Шаг', level: 17, endless: 29, duelWins: 64, time: 120500 },
    { nick: 'Зеркальце', level: 15, endless: 41, duelWins: 12, time: 98000 },
    { nick: 'ФигураНеПройдёт', level: 12, endless: 22, duelWins: 31, time: 77000 },
    { nick: 'Фонарик', level: 9, endless: 18, duelWins: 8, time: 50200 },
    { nick: 'Тимоти_Тимотиевич', level: 6, endless: 12, duelWins: 3, time: 21000 }
  ];

  // Препятствия: r — радиус в клетках, tall — закрывает обзор и для летающих целей,
  // los:false — не мешает обзору, но занимает место (лава).
  const OBSTACLES = {
    wardrobe: { name: 'Шкаф', r: 0.5, tall: true },
    pillar: { name: 'Колонна', r: 0.42, tall: true },
    plant: { name: 'Фикус', r: 0.38, tall: true },
    table: { name: 'Столик', r: 0.42, tall: false },
    luggage: { name: 'Чемоданы', r: 0.36, tall: false },
    mirror: { name: 'Зеркало', r: 0.45, tall: true },
    rock: { name: 'Валун', r: 0.44, tall: false },
    beam: { name: 'Крепь', r: 0.34, tall: true },
    cart: { name: 'Вагонетка', r: 0.45, tall: false },
    barrel: { name: 'Бочка', r: 0.33, tall: false },
    crystal: { name: 'Кристалл', r: 0.42, tall: true },
    stalagmite: { name: 'Сталагмит', r: 0.38, tall: true },
    lava: { name: 'Лавовая лужа', r: 0.5, tall: false, los: false }
  };
  const THEME_OBSTACLES = {
    lobby: { fixed: ['wardrobe', 'pillar', 'plant', 'table', 'luggage'], spawn: ['luggage', 'wardrobe', 'plant'] },
    corridor: { fixed: ['wardrobe', 'plant', 'table', 'luggage'], spawn: ['wardrobe', 'luggage'] },
    mirrors: { fixed: ['mirror', 'pillar', 'table'], spawn: ['mirror'] },
    mine: { fixed: ['rock', 'beam', 'cart', 'barrel'], spawn: ['rock', 'barrel'] },
    crystal: { fixed: ['crystal', 'rock', 'crystal'], spawn: ['crystal', 'rock'] },
    depths: { fixed: ['stalagmite', 'rock', 'lava'], spawn: ['rock', 'stalagmite'] }
  };

  // Бот дуэли подбирается под уровень игрока: навык 0..1.
  const botSkill = level => Math.max(0.12, Math.min(0.95, 0.12 + (level - 1) * 0.035));
  const BOT_NAMES = ['Бот-Портье', 'Бот-Ключник', 'Бот-Фонарщик', 'Бот-Горничная', 'Бот-Шахтёр', 'Бот-Смотритель'];

  K.HEROES = HEROES;
  K.HERO = Object.fromEntries(HEROES.map(h => [h.id, h]));
  K.SKILLS = SKILLS;
  K.ENEMIES = ENEMIES;
  K.DIFFS = DIFFS;
  // Карты шире по горизонтали: заполняют вертикальный кадр без пустых полос.
  MAPS.forEach(m => m.paths.forEach(p => p.forEach(q => { q[0] = +(q[0] * 1.6).toFixed(3); })));
  K.MAPS = MAPS;
  K.MAP = Object.fromEntries(MAPS.map(m => [m.id, m]));
  K.PLAYER_COLORS = PLAYER_COLORS;
  K.ACHIEVEMENTS = ACHIEVEMENTS;
  K.DEMO_PLAYERS = DEMO_PLAYERS;
  K.OBSTACLES = OBSTACLES;
  K.THEME_OBSTACLES = THEME_OBSTACLES;
  K.botSkill = botSkill;
  K.BOT_NAMES = BOT_NAMES;
  K.TOWER_R = 0.7;
  K.ROAD_R = 0.55;
  K.BOUNDS = { x0: -8.6, x1: 8.6, z0: -10, z1: 9.3 };
  K.MAP_WIDEN = 1.6;
  K.SQUAD_MAX = 4;
  K.SECRET_CODE = 'MINES';
  K.THEMES = { hotel: { name: 'Отель', desc: 'Тёмный отель: латунь и мятный свет' }, mine: { name: 'Шахты', desc: 'Камень, крепь и свет фонарей', secret: true } };
  K.RARITY_ORDER = ['Новичковый', 'Обычный', 'Необычный', 'Редкий', 'Эпический', 'Легендарный'];
  K.SELL_RATE = 0.7;
})(globalThis.KV = globalThis.KV || {});
