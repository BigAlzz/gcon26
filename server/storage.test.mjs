import assert from 'node:assert/strict';
import test from 'node:test';
import { createConfiguredStore, LocalEncryptedStore, providerStatus, SqlServerStore } from './storage.mjs';

const withEnvironment = async (values, callback) => {
  const names = [...new Set([...Object.keys(values), 'GCON_DATABASE_PROVIDER', 'MSSQL_CONNECTION_STRING', 'SQLSERVER_CONNECTION_STRING'])];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(values, name)) process.env[name] = values[name];
      else delete process.env[name];
    }
    return await callback();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
};

test('defaults to the encrypted local adapter', async () => {
  await withEnvironment({}, () => {
    assert.ok(createConfiguredStore() instanceof LocalEncryptedStore);
    assert.equal(providerStatus().mode, 'local-development-adapter');
  });
});

test('fails closed when SQL Server is requested without a connection string', async () => {
  await withEnvironment({ GCON_DATABASE_PROVIDER: 'sqlserver' }, () => {
    assert.throws(() => createConfiguredStore(), /requires MSSQL_CONNECTION_STRING/);
    assert.equal(providerStatus().mode, 'sqlserver-misconfigured');
  });
});

test('selects the SQL Server adapter when configured', async () => {
  await withEnvironment({ GCON_DATABASE_PROVIDER: 'sqlserver', MSSQL_CONNECTION_STRING: 'Server=localhost;Database=GCON;User Id=test;Password=test;Encrypt=False;' }, () => {
    const store = createConfiguredStore();
    assert.ok(store instanceof SqlServerStore);
    assert.equal(providerStatus().mode, 'sqlserver-adapter');
    return store.close();
  });
});
