import { test, expect } from '@playwright/test';

test.describe('Funcionalidades principais', () => {
  test.beforeEach(async ({ page }) => {
    // Garante que o backend está respondendo antes de cada teste
    await page.goto('http://localhost:3000');
  });

  test('deve criar uma nova trajetória', async ({ page }) => {
    // Navega para a página de criação
    await page.goto('http://localhost:3000/create-trajectory');
    
    // Preenche o formulário
    await page.fill('input[name="name"]', 'Trajetória E2E');
    
    // Adiciona um comando de movimento
    await page.click('button:has-text("Adicionar Comando")');
    await page.selectOption('select[name="commands.0.type"]', 'move');
    await page.fill('input[name="commands.0.value"]', '100');
    await page.fill('input[name="commands.0.unit"]', 'mm');
    
    // Submete o formulário
    await page.click('button[type="submit"]');
    
    // Verifica redirecionamento
    await expect(page).toHaveURL(/.*\/results/);
    
    // Verifica se a trajetória aparece na lista
    const trajetoriaNome = await page.textContent('.trajectory-name');
    expect(trajetoriaNome).toContain('Trajetória E2E');
  });

  test('deve mostrar estatísticas na página inicial', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Verifica se os cards de estatísticas estão presentes
    await expect(page.locator('.stats-card')).toHaveCount(2);
    
    // Verifica se os valores são números
    const totalSaved = await page.textContent('.total-saved');
    expect(Number(totalSaved)).not.toBeNaN();
  });

  test('deve listar trajetórias existentes', async ({ page }) => {
    await page.goto('http://localhost:3000/results');
    
    // Verifica se a lista de trajetórias está presente
    await expect(page.locator('.trajectory-list')).toBeVisible();
    
    // Verifica se tem pelo menos uma trajetória
    const trajectories = await page.locator('.trajectory-item').count();
    expect(trajectories).toBeGreaterThan(0);
  });
});