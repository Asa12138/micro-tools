// Assemble the edited teaching units into the four downloadable courses.
const fs = require('fs');
const path = require('path');
const C = require('../../features/english/english-core');
const root = process.argv[2];
if (!root || !path.isAbsolute(root)) throw Error('Provide the absolute output directory');
const source = path.join(__dirname, 'source/courses');
const destination = path.join(root, 'v1/courses');
const packs = [
  { id: 'research-communication', tags: ["科研交流", "博后面试", "会议讨论"], title: '科研交流与博后面试', domain: 'communication', units: ['research-introduction', 'postdoc-interview', 'conference-discussion'], description: '60 句原创教学表达：1–20 研究介绍，21–40 博后面试，41–60 会议交流。练习说明研究问题、表达个人贡献、回应现场追问；第一人称内容请按真实经历修改。' },
  { id: 'bioinformatics-reproducibility', tags: ["生信分析", "模型验证", "可复现研究"], title: '生信分析与可复现研究', domain: 'methods', units: ['bioinformatics-workflow', 'machine-learning-validation', 'reproducible-research'], description: '60 句原创教学表达：1–20 生信分析流程，21–40 模型验证，41–60 可复现研究。练习讲清质量控制、数据划分、模型评价及分析记录；方法选择需结合实际研究设计。' },
  { id: 'microbiome-environment', tags: ["微生物生态", "环境研究", "统计解释"], title: '微生物生态与环境研究', domain: 'environment', units: ['microbiome-ecology', 'soil-carbon-environment', 'statistics-interpretation'], description: '60 句原创教学表达：1–20 微生物生态，21–40 土壤与环境，41–60 统计解释。练习描述群落差异、环境关联及不确定性；表达模板中的研究情境请替换为真实项目。' },
  { id: 'reading-discussion', tags: ["论文精读", "讲图", "组会讨论"], title: '论文精读与学术讨论', domain: 'reading', units: ['paper-reading', 'figures-and-limitations', 'collaboration-meetings'], description: '60 句原创教学表达：1–20 论文阅读，21–40 讲图与研究限制，41–60 合作与组会。练习提炼问题、解释结果图、提出建设性问题与商定下一步；并非具体论文的原文摘录。' }
];
fs.mkdirSync(destination, { recursive: true });
for (const pack of packs) {
  const { id, units, ...metadata } = pack;
  const sentences = units.flatMap(unit => {
    const course = JSON.parse(fs.readFileSync(path.join(source, unit + '.json'), 'utf8'));
    if (course.sentences.length !== 20) throw Error(unit + ' must contain 20 sentences');
    return course.sentences;
  });
  const course = C.exportCourse({ ...metadata, level: '★★★', source: { title: '科研小盒原创科研英语课程 · 2026-10', url: '', kind: 'original' }, sentences });
  fs.writeFileSync(path.join(destination, id + '.json'), JSON.stringify(course, null, 2) + '\n');
}
console.log('Assembled 4 courses with 240 original sentences at ' + root);
