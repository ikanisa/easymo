"use client";

import type { Agent } from "@/src/v2/lib/supabase/hooks";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface AgentDetailsModalProps {
  agent: Agent;
  onClose: () => void;
}

export function AgentDetailsModal({ agent, onClose }: AgentDetailsModalProps) {
  return (
    <Transition.Root show as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-lg bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-gray-200 p-6">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      {agent.name}
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500">Agent ID: {agent.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Close agent details"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 p-6">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Phone</dt>
                      <dd className="mt-1 text-sm text-gray-900">{agent.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Status</dt>
                      <dd className="mt-1">
                        <span
                          className={
                            agent.status === "active"
                              ? "inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
                              : "inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800"
                          }
                        >
                          {agent.status}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Joined</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Wallet balance</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        ${Number(agent.wallet_balance ?? 0).toFixed(2)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
