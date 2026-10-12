revoke execute on function public.create_durability_probe(uuid,bigint) from public, anon;
revoke execute on function public.bind_durable_workflow(uuid,text) from public, anon;
revoke execute on function public.request_cancel_runtime_execution(uuid) from public, anon;

grant execute on function public.create_durability_probe(uuid,bigint) to authenticated;
grant execute on function public.bind_durable_workflow(uuid,text) to authenticated;
grant execute on function public.request_cancel_runtime_execution(uuid) to authenticated;
