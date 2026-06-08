#!/usr/bin/env python3
"""Convert downloaded wordbook CSVs to the app's format.

Source format (with header): word,phonetic,chinese,example_en,example_zh,unit
Target format (no header): english,chinese,phonetic,exampleEn,exampleCn,explanation
"""

import csv
import re
import sys
from pathlib import Path

SOURCE_DIR = Path("/Users/duguguiyu-work/Downloads")
TARGET_DIR = Path(__file__).parent.parent / "datasets"

FILES = [
    ("Unit1_Visiting_Canada.csv", "unit1", "Unit 1 Visiting Canada"),
    ("Unit2_All_Around_Me.csv", "unit2", "Unit 2 All Around Me"),
    ("Unit3_Daily_Life.csv", "unit3", "Unit 3 Daily Life"),
    ("Unit4_Free_Time.csv", "unit4", "Unit 4 Free Time"),
    ("Unit5_Nature_and_Culture.csv", "unit5", "Unit 5 Nature and Culture"),
    ("Unit6_Summer_Vacation.csv", "unit6", "Unit 6 Summer Vacation"),
]

BETTER_EXAMPLES = {
    "excited": ("I'm so excited about the trip!", "我对这次旅行非常兴奋！"),
    "winter": ("It snows a lot in winter.", "冬天经常下雪。"),
    "tomorrow": ("We will go to school tomorrow.", "我们明天要去学校。"),
    "week": ("There are seven days in a week.", "一个星期有七天。"),
    "month": ("January is the first month of the year.", "一月是一年中的第一个月。"),
    "worried": ("She is worried about the exam.", "她担心考试。"),
    "summer": ("We go swimming in summer.", "我们夏天去游泳。"),
    "autumn": ("The leaves turn red in autumn.", "秋天树叶变红了。"),
    "clothes": ("Put on warm clothes before going out.", "出门前穿上暖和的衣服。"),
    "coat": ("Wear your coat, it's cold outside.", "穿上你的外套，外面很冷。"),
    "sweater": ("This sweater keeps me warm.", "这件毛衣让我很暖和。"),
    "jacket": ("He wore a blue jacket to school.", "他穿了一件蓝色夹克去学校。"),
    "food": ("Chinese food is delicious.", "中国食物很美味。"),
    "book": ("I read a book every night.", "我每晚都读一本书。"),
    "umbrella": ("Take an umbrella, it might rain.", "带把伞，可能会下雨。"),
    "father": ("My father works in a hospital.", "我的父亲在医院工作。"),
    "nurse": ("The nurse takes care of patients.", "护士照顾病人。"),
    "grandfather": ("My grandfather is old but healthy.", "我的祖父年纪大了但很健康。"),
    "mother": ("My mother cooks dinner every day.", "我的妈妈每天做晚饭。"),
    "cousin": ("My cousin lives in Beijing.", "我的表弟住在北京。"),
    "astronaut": ("The astronaut went to space.", "宇航员去了太空。"),
    "saleswoman": ("The saleswoman helped us find a gift.", "女售货员帮我们找到了一份礼物。"),
    "helpful": ("She is always helpful to others.", "她总是乐于帮助别人。"),
    "polite": ("It is polite to say please and thank you.", "说请和谢谢是有礼貌的。"),
    "January": ("January is the coldest month.", "一月是最冷的月份。"),
    "February": ("February has only 28 days.", "二月只有28天。"),
    "August": ("We have summer vacation in August.", "我们八月放暑假。"),
    "September": ("School starts in September.", "学校九月开学。"),
    "October": ("October first is National Day.", "十月一日是国庆节。"),
    "November": ("November is getting cold.", "十一月天气开始变冷。"),
    "December": ("December is the last month of the year.", "十二月是一年中的最后一个月。"),
    "left": ("Turn left at the traffic light.", "在红绿灯处左转。"),
    "right": ("The park is on your right.", "公园在你的右边。"),
    "shops": ("There are many shops on this street.", "这条街上有很多商店。"),
    "garden": ("There are beautiful flowers in the garden.", "花园里有美丽的花。"),
    "theatre": ("We watched a play at the theatre.", "我们在剧院看了一场戏。"),
    "around": ("There are trees all around the park.", "公园周围都是树。"),
    "south": ("Hainan is in the south of China.", "海南在中国的南方。"),
    "third": ("My classroom is on the third floor.", "我的教室在三楼。"),
    "hard": ("This maths problem is very hard.", "这道数学题很难。"),
    "fun": ("Playing games is so much fun!", "玩游戏太有趣了！"),
    "playground": ("The children play on the playground.", "孩子们在操场上玩耍。"),
    "floor": ("My classroom is on the second floor.", "我的教室在二楼。"),
    "Tuesday": ("We have art class on Tuesday.", "我们星期二有美术课。"),
    "Wednesday": ("Wednesday is the middle of the week.", "星期三是一周的中间。"),
    "Thursday": ("We play sports on Thursday.", "我们星期四做运动。"),
    "Saturday": ("I visit my grandparents on Saturday.", "我星期六去看望祖父母。"),
    "boring": ("The movie was really boring.", "这部电影真的很无聊。"),
    "fantastic": ("The show was fantastic!", "这场表演太棒了！"),
    "wonderful": ("What a wonderful day!", "多么美好的一天！"),
    "cartoons": ("Children love watching cartoons.", "孩子们喜欢看动画片。"),
    "behind": ("The cat is hiding behind the door.", "猫躲在门后面。"),
    "teacher": ("Our teacher is very kind.", "我们的老师非常和蔼。"),
    "classmate": ("Tom is my classmate.", "汤姆是我的同学。"),
    "glasses": ("My father wears glasses.", "我的父亲戴眼镜。"),
    "hardworking": ("She is a hardworking student.", "她是一个勤奋的学生。"),
    "beautiful": ("The sunset is beautiful.", "日落很美丽。"),
    "handsome": ("Her brother is very handsome.", "她的哥哥很英俊。"),
    "pretty": ("The flowers are so pretty.", "这些花真漂亮。"),
    "slim": ("She is tall and slim.", "她又高又苗条。"),
    "school": ("I walk to school every day.", "我每天步行去学校。"),
    "housework": ("I help my mum with housework.", "我帮妈妈做家务。"),
    "square": ("People dance in the square every evening.", "人们每天晚上在广场上跳舞。"),
    "twice": ("I brush my teeth twice a day.", "我一天刷两次牙。"),
    "sandwich": ("I had a sandwich for lunch.", "我午饭吃了一个三明治。"),
    "sausage": ("Would you like a sausage?", "你想要一根香肠吗？"),
    "chicken": ("We had chicken for dinner.", "我们晚饭吃了鸡肉。"),
    "peanut": ("I like eating peanuts as a snack.", "我喜欢吃花生当零食。"),
    "dumpling": ("We eat dumplings on New Year's Eve.", "我们在除夕吃饺子。"),
    "noodles": ("I like eating noodles for breakfast.", "我喜欢早饭吃面条。"),
    "hamburger": ("He bought a hamburger for lunch.", "他午饭买了一个汉堡包。"),
    "cola": ("Can I have a glass of cola?", "我能喝一杯可乐吗？"),
    "coffee": ("Adults often drink coffee in the morning.", "大人们早上经常喝咖啡。"),
    "first": ("First, wash your hands.", "首先，洗手。"),
    "next": ("Next, open your book.", "接下来，打开你的书。"),
    "then": ("Then, read the story.", "然后，读故事。"),
    "last": ("Last, answer the questions.", "最后，回答问题。"),
    "cold": ("I have a cold today.", "我今天感冒了。"),
    "headache": ("I have a headache and need to rest.", "我头痛，需要休息。"),
    "stomachache": ("He has a stomachache from eating too much.", "他吃太多了，胃痛。"),
    "toothache": ("I have a toothache, I need to see a dentist.", "我牙痛，需要去看牙医。"),
    "hockey": ("Hockey is a popular sport in Canada.", "曲棍球在加拿大是一项很流行的运动。"),
    "skating": ("We go skating in winter.", "我们冬天去滑冰。"),
    "skiing": ("Skiing is my favourite winter sport.", "滑雪是我最喜欢的冬季运动。"),
    "maths": ("I'm good at maths.", "我数学很好。"),
    "music": ("She likes listening to music.", "她喜欢听音乐。"),
    "science": ("We have science class on Monday.", "我们星期一有科学课。"),
    "always": ("I always get up early.", "我总是早起。"),
    "sometimes": ("I sometimes walk to school.", "我有时步行去学校。"),
    "never": ("I never eat candy before bed.", "我从不在睡前吃糖。"),
    "hobbies": ("What are your hobbies?", "你的爱好是什么？"),
    "library": ("I like to read in the library.", "我喜欢在图书馆读书。"),
    "beach": ("We play on the beach in summer.", "我们夏天在海滩上玩。"),
    "bookstore": ("I bought a new book at the bookstore.", "我在书店买了一本新书。"),
    "bank": ("My mother works at a bank.", "我妈妈在银行工作。"),
    "family": ("I love my family.", "我爱我的家人。"),
    "danced": ("We danced at the party last night.", "我们昨晚在聚会上跳舞了。"),
    "watched": ("I watched a movie yesterday.", "我昨天看了一部电影。"),
    "jumped": ("The cat jumped onto the table.", "猫跳到了桌子上。"),
    "listened": ("I listened to music after school.", "我放学后听了音乐。"),
    "rowed": ("We rowed a boat on the lake.", "我们在湖上划了船。"),
    "played": ("The children played in the park.", "孩子们在公园里玩了。"),
    "was": ("He was happy yesterday.", "他昨天很开心。"),
    "were": ("They were at school this morning.", "他们今天早上在学校。"),
    "did": ("What did you do last weekend?", "你上个周末做了什么？"),
    "won": ("Our team won the game!", "我们队赢了比赛！"),
    "went": ("I went to the park yesterday.", "我昨天去了公园。"),
    "drank": ("She drank a glass of milk.", "她喝了一杯牛奶。"),
    "swam": ("We swam in the pool last summer.", "我们去年夏天在游泳池游泳了。"),
    "ate": ("I ate an apple for breakfast.", "我早饭吃了一个苹果。"),
    "bought": ("She bought a new dress.", "她买了一条新裙子。"),
    "took": ("He took a photo of the sunset.", "他拍了一张日落的照片。"),
    "saw": ("I saw a rainbow this morning.", "我今天早上看见了一道彩虹。"),
    "slept": ("The baby slept all night.", "宝宝睡了一整夜。"),
    "felt": ("I felt happy after the test.", "考试后我感到很开心。"),
    "made": ("She made a birthday card for me.", "她给我做了一张生日贺卡。"),
    "drew": ("He drew a picture of a cat.", "他画了一只猫。"),
    "read": ("I read a story before bed.", "我睡前读了一个故事。"),
    "sang": ("We sang songs at the party.", "我们在聚会上唱了歌。"),
    "ran": ("He ran fast in the race.", "他在比赛中跑得很快。"),
    "had": ("I had a great time at the zoo.", "我在动物园玩得很开心。"),
    "swept": ("I swept the floor after dinner.", "晚饭后我扫了地。"),
    "came": ("My friend came to visit me.", "我的朋友来看我了。"),
    "flew": ("The bird flew high in the sky.", "鸟儿在天空中飞得很高。"),
    "rode": ("She rode a bike to school.", "她骑自行车去学校。"),
    "wrote": ("I wrote a letter to my pen pal.", "我给笔友写了一封信。"),
    "boating": ("We went boating on the lake.", "我们在湖上划船了。"),
    "elephants": ("Elephants are the largest land animals.", "大象是最大的陆地动物。"),
    "mammals": ("Whales and dolphins are mammals.", "鲸鱼和海豚是哺乳动物。"),
    "butterfly": ("A beautiful butterfly landed on the flower.", "一只美丽的蝴蝶落在了花上。"),
    "elephant": ("An elephant has a long trunk.", "大象有一个长鼻子。"),
    "penguin": ("Penguins live in cold places.", "企鹅生活在寒冷的地方。"),
    "tiger": ("The tiger is strong and fast.", "老虎又强壮又快。"),
    "bird": ("The bird is singing in the tree.", "鸟儿在树上唱歌。"),
    "fish": ("There are many fish in the river.", "河里有很多鱼。"),
    "insect": ("A ladybug is a kind of insect.", "瓢虫是一种昆虫。"),
    "mammal": ("A cat is a mammal.", "猫是哺乳动物。"),
    "reptile": ("A snake is a reptile.", "蛇是爬行动物。"),
    "tail": ("The dog wags its tail happily.", "狗高兴地摇尾巴。"),
    "black": ("She has a black cat.", "她有一只黑猫。"),
    "brown": ("The bear has brown fur.", "熊有棕色的毛。"),
    "grey": ("The sky looks grey today.", "今天天空看起来灰蒙蒙的。"),
    "curly": ("She has curly hair.", "她有卷发。"),
    "straight": ("He has straight black hair.", "他有直的黑发。"),
    "dangerous": ("Don't play near the road, it's dangerous.", "不要在马路边玩，很危险。"),
    "jump": ("Rabbits can jump very high.", "兔子能跳得很高。"),
    "meat": ("Lions eat meat.", "狮子吃肉。"),
    "fruit": ("Eating fruit is good for your health.", "吃水果对健康有益。"),
    "grass": ("Cows eat grass.", "牛吃草。"),
    "leaf": ("The leaf turned yellow in autumn.", "树叶在秋天变黄了。"),
    "bamboo": ("Pandas love eating bamboo.", "熊猫喜欢吃竹子。"),
    "kangaroo": ("Kangaroos live in Australia.", "袋鼠生活在澳大利亚。"),
    "Washington D.C.": ("Washington D.C. is the capital of the USA.", "华盛顿特区是美国的首都。"),
    "the Great Wall": ("The Great Wall is very long and old.", "长城又长又古老。"),
    "cold drink": ("I want a cold drink on this hot day.", "这么热的天我想喝一杯冷饮。"),
    "hot pot": ("Hot pot is popular in Sichuan.", "火锅在四川很流行。"),
    "spicy food": ("People in Sichuan love spicy food.", "四川人喜欢辣味食物。"),
    "shopping list": ("Mum wrote a shopping list.", "妈妈写了一份购物清单。"),
    "tomatoes": ("Please buy some tomatoes.", "请买些西红柿。"),
    "jigsaw puzzles": ("I like doing jigsaw puzzles.", "我喜欢拼拼图。"),
    "glue stick": ("I need a glue stick for my project.", "我的手工项目需要胶棒。"),
    "exercise book": ("Write the answers in your exercise book.", "把答案写在练习本上。"),
    "pencil sharpener": ("Can I borrow your pencil sharpener?", "我能借你的卷笔刀吗？"),
    "ice lantern": ("Ice lanterns are beautiful at night.", "冰灯在夜晚很美。"),
    "morning tea": ("People in Guangdong enjoy morning tea.", "广东人喜欢喝早茶。"),
    "taste soup": ("Let me taste the soup.", "让我尝尝汤。"),
    "street dancing": ("Street dancing is cool and exciting.", "街舞很酷很刺激。"),
    "information centre": ("Go to the information centre for help.", "去信息中心寻求帮助。"),
    "science room": ("We do experiments in the science room.", "我们在科学教室做实验。"),
    "visit": ("I want to visit my grandma this weekend.", "我这个周末想去看望奶奶。"),
    "vacation": ("Where did you go on vacation?", "你假期去了哪里？"),
    "crayon": ("She drew a picture with crayons.", "她用蜡笔画了一幅画。"),
    "knife": ("Be careful with the knife.", "小心刀子。"),
    "vegetable": ("We should eat more vegetables.", "我们应该多吃蔬菜。"),
    "potato": ("I like baked potatoes.", "我喜欢烤土豆。"),
    "bread": ("I eat bread for breakfast.", "我早饭吃面包。"),
    "southwest": ("Yunnan is in the southwest of China.", "云南在中国的西南。"),
    "north": ("Beijing is in the north of China.", "北京在中国的北方。"),
    "east": ("Shanghai is in the east of China.", "上海在中国的东部。"),
    "west": ("The sun sets in the west.", "太阳在西边落下。"),
    "subway": ("I take the subway to school.", "我乘地铁去学校。"),
    "juice": ("I'd like a glass of orange juice.", "我想要一杯橙汁。"),
    "seafood": ("I love eating seafood.", "我喜欢吃海鲜。"),
    "ice-skating": ("We go ice-skating in winter.", "我们冬天去滑冰。"),
}


def is_bad_example(word: str, example_en: str) -> bool:
    """Detect template-generated broken examples."""
    w_lower = word.lower()
    patterns = [
        f"I often {re.escape(w_lower)} with my friends",
        f"We talked about {re.escape(w_lower)} in class today",
        f"The weather is {re.escape(w_lower)} today",
        f"I want to learn more about {re.escape(w_lower)}",
        f"There is a {re.escape(w_lower)} near my home",
        f"I like {re.escape(w_lower)}",
    ]
    ex_lower = example_en.lower().rstrip(".")
    for pat in patterns:
        if re.match(pat, ex_lower, re.IGNORECASE):
            return True
    return False


def convert_file(source_path: Path, target_path: Path) -> int:
    """Convert a single wordbook CSV. Returns word count."""
    rows = []
    with open(source_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)  # skip header
        for row in reader:
            if len(row) < 5:
                continue
            word = row[0].strip()
            phonetic = row[1].strip()
            chinese = row[2].strip()
            example_en = row[3].strip()
            example_cn = row[4].strip()

            if not word:
                continue

            # Fix bad examples
            if word in BETTER_EXAMPLES:
                example_en, example_cn = BETTER_EXAMPLES[word]
            elif is_bad_example(word, example_en):
                # Keep the template example if we don't have a better one
                # but at least mark ones that are grammatically broken
                if "I often " in example_en and not any(
                    example_en.lower().startswith(f"i often {v}")
                    for v in [
                        "play", "go", "eat", "read", "ride", "take", "row",
                        "fly", "see", "collect", "listen", "write", "jump",
                        "make", "draw", "walk", "feed", "sweep", "cook",
                        "wash", "tidy", "visit", "climb", "drink", "wear",
                        "do", "get",
                    ]
                ):
                    # This is a broken "I often [noun] with my friends"
                    example_en = ""
                    example_cn = ""

            rows.append([word, chinese, phonetic, example_en, example_cn, ""])

    with open(target_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        for row in rows:
            writer.writerow(row)

    return len(rows)


def main():
    total = 0
    for filename, unit_id, unit_name in FILES:
        source = SOURCE_DIR / filename
        target = TARGET_DIR / f"school_6_{unit_id}.csv"

        if not source.exists():
            print(f"ERROR: {source} not found")
            sys.exit(1)

        count = convert_file(source, target)
        total += count
        print(f"  {unit_name}: {count} words -> {target.name}")

    print(f"\nTotal: {total} words across {len(FILES)} wordbooks")


if __name__ == "__main__":
    main()
