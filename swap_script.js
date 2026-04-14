const fs = require('fs');
const file = '../crm-client/src/components/ActionConfigTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// The react component has: 'chains' state storing trees, 'rules' state storing links
// We want 'chains' state to store 'ActionChain' (Links)
// and 'rules' state to store 'ActionRule' (Trees)

content = content.replace(/ActionChain/g, 'ActionRule_TMP');
content = content.replace(/ActionRule/g, 'ActionChain');
content = content.replace(/ActionRule_TMP/g, 'ActionRule');

content = content.replace(/chainForm/g, 'ruleForm_TMP');
content = content.replace(/ruleForm/g, 'chainForm');
content = content.replace(/ruleForm_TMP/g, 'ruleForm');

content = content.replace(/isChainModalOpen/g, 'isRuleModalOpen_TMP');
content = content.replace(/isRuleModalOpen/g, 'isChainModalOpen');
content = content.replace(/isRuleModalOpen_TMP/g, 'isRuleModalOpen');

content = content.replace(/apiService.createChain/g, 'apiService.createRule_TMP');
content = content.replace(/apiService.createRule/g, 'apiService.createChain');
content = content.replace(/apiService.createRule_TMP/g, 'apiService.createRule');

content = content.replace(/apiService.updateChain/g, 'apiService.updateRule_TMP');
content = content.replace(/apiService.updateRule/g, 'apiService.updateChain');
content = content.replace(/apiService.updateRule_TMP/g, 'apiService.updateRule');

content = content.replace(/apiService.deleteChain/g, 'apiService.deleteRule_TMP');
content = content.replace(/apiService.deleteRule/g, 'apiService.deleteChain');
content = content.replace(/apiService.deleteRule_TMP/g, 'apiService.deleteRule');

// Handle setChains vs setRules
content = content.replace(/setChains/g, 'setRules_TMP');
content = content.replace(/setRules/g, 'setChains');
content = content.replace(/setRules_TMP/g, 'setRules');

// To avoid messing up strings inside 'rules' filtering logic, do it specifically:
content = content.replace(/\.chains/g, '.rules_TMP');
content = content.replace(/\.rules/g, '.chains');
content = content.replace(/\.rules_TMP/g, '.rules');

content = content.replace(/const chains /g, 'const rules_TMP ');
content = content.replace(/const rules /g, 'const chains ');
content = content.replace(/const rules_TMP /g, 'const rules ');

content = content.replace(/chains,/g, 'rules_TMP,');
content = content.replace(/rules,/g, 'chains,');
content = content.replace(/rules_TMP,/g, 'rules,');

content = content.replace(/chains\)/g, 'rules_TMP)');
content = content.replace(/rules\)/g, 'chains)');
content = content.replace(/rules_TMP\)/g, 'rules)');

content = content.replace(/chains\]/g, 'rules_TMP]');
content = content.replace(/rules\]/g, 'chains]');
content = content.replace(/rules_TMP\]/g, 'rules]');

// Fix subTab logic text UI carefully
content = content.replace(/Chào bạn,/g, 'Welcome!');

fs.writeFileSync(file, content, 'utf8');
console.log('Swapped component variables locally');
