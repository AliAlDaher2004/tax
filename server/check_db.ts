import { supabase } from './src/db';

async function check() {
  try {
    const { data: companies, error: compErr } = await supabase.from('companies').select('*');
    const { data: materials, error: matErr } = await supabase.from('materials').select('*');
    const { data: exemptions, error: exErr } = await supabase.from('material_exemptions').select('*');
    const { data: requests, error: reqErr } = await supabase.from('requests').select('*');

    console.log('--- DATABASE CHECK ---');
    console.log('Companies Count:', companies ? companies.length : 0);
    console.log('Companies:', companies);
    console.log('Materials Count:', materials ? materials.length : 0);
    console.log('Materials:', materials);
    console.log('Exemptions Count:', exemptions ? exemptions.length : 0);
    console.log('Requests Count:', requests ? requests.length : 0);
  } catch (err: any) {
    console.error('Error querying database:', err.message);
  }
}

check();
