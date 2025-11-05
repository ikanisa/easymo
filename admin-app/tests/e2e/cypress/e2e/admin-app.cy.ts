describe('Admin PWA critical flows', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/auth/v1/token', {
      access_token: 'mock-token',
      user: { id: 'user_1' },
    }).as('login');
    cy.intercept('GET', '**/rest/v1/dashboard*', {
      totalTrips: 5,
      activeBaskets: 2,
      flags: { 'deeplinks.enabled': true },
    }).as('dashboard');
  });

  it('authenticates and surfaces dashboard KPIs', () => {
    cy.visit('/login');
    cy.get('input[name="email"]').type('admin@easymo.app');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@login');
    cy.contains('Dashboard').should('be.visible');
    cy.contains('Total Trips').should('contain', '5');
  });

  it('creates and edits managed content', () => {
    cy.visit('/records');
    cy.intercept('GET', '**/rest/v1/records*', [{ id: 'rec_1', name: 'Sample' }]);
    cy.get('[data-testid="create-record"]').click();
    cy.get('input[name="name"]').type('Station A');
    cy.contains('Save').click();
    cy.contains('Station A').should('exist');
    cy.contains('Edit Station A').click();
    cy.get('input[name="name"]').clear().type('Station Alpha');
    cy.contains('Save').click();
    cy.contains('Station Alpha').should('exist');
  });

  it('survives offline mode by surfacing cached banner', () => {
    cy.visit('/dashboard');
    cy.window().then((win) => {
      win.dispatchEvent(new Event('offline'));
    });
    cy.contains('You appear to be offline').should('be.visible');
    cy.window().then((win) => {
      win.dispatchEvent(new Event('online'));
    });
  });

  it('toggles feature flags with server confirmation', () => {
    cy.visit('/settings/flags');
    cy.intercept('GET', '**/rest/v1/feature_flags*', [{ key: 'deeplinks.enabled', value: true }]);
    cy.intercept('PATCH', '**/rest/v1/feature_flags*', {
      statusCode: 200,
      body: { key: 'deeplinks.enabled', value: false },
    }).as('flagUpdate');
    cy.get('[data-testid="feature-flag-toggle"]').first().click();
    cy.wait('@flagUpdate');
    cy.contains('deeplinks.enabled disabled').should('be.visible');
  });
});
